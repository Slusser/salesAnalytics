import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import type { CustomerMutatorContext } from '@shared/dtos/customers.dto';
import type {
  BaseOrderCommand,
  CreateOrderCommand,
  DeleteOrderCommand,
  ListOrdersQuery,
  ListOrdersResponse,
  OrderDetailDto,
  UpdateOrderCommand,
} from '@shared/dtos/orders.dto';
import { OrdersRepository } from './orders.repository';
import { SupabaseFactory } from '../../supabase/supabase.factory';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@db/database.types';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const DEFAULT_SORT_FIELD: NonNullable<ListOrdersQuery['sort']> =
  'createdAt:desc';

const AMOUNT_TOLERANCE = 0.01;

const SORT_PARSER: Record<
  string,
  { field: NonNullable<ListOrdersQuery['sort']>; direction: 'asc' | 'desc' }
> = {
  'createdat:asc': { field: 'createdAt:asc', direction: 'asc' },
  'createdat:desc': { field: 'createdAt:desc', direction: 'desc' },
  'orderdate:asc': { field: 'orderDate:asc', direction: 'asc' },
  'orderdate:desc': { field: 'orderDate:desc', direction: 'desc' },
  'orderno:asc': { field: 'orderNo:asc', direction: 'asc' },
  'orderno:desc': { field: 'orderNo:desc', direction: 'desc' },
  'customername:asc': { field: 'customerName:asc', direction: 'asc' },
  'customername:desc': { field: 'customerName:desc', direction: 'desc' },
  'totalnetpln:asc': { field: 'totalNetPln:asc', direction: 'asc' },
  'totalnetpln:desc': { field: 'totalNetPln:desc', direction: 'desc' },
};

const SORT_FIELD_MAP: Record<
  string,
  'orderDate' | 'orderNo' | 'customerName' | 'totalNetPln' | 'createdAt'
> = {
  createdAt: 'createdAt',
  orderDate: 'orderDate',
  orderNo: 'orderNo',
  customerName: 'customerName',
  totalNetPln: 'totalNetPln',
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly repository: OrdersRepository,
    private readonly supabaseFactory: SupabaseFactory
  ) {}

  async list(
    query: ListOrdersQuery,
    user: CustomerMutatorContext
  ): Promise<ListOrdersResponse> {
    if (!user) {
      throw new ForbiddenException('Brak uwierzytelnionego użytkownika.');
    }

    const roles = user.actorRoles ?? [];
    const isElevated = roles.some(
      (role) => role === 'editor' || role === 'owner'
    );

    if (query.includeDeleted && !isElevated) {
      throw new ForbiddenException(
        'Brak uprawnień do przeglądania usuniętych zamówień.'
      );
    }

    const supabase = this.getSupabaseClientOrThrow(user.accessToken, () => {
      throw new InternalServerErrorException({
        code: 'ORDERS_SUPABASE_TOKEN_MISSING',
        message: 'Brak tokenu dostępowego użytkownika wykonującego operację.',
      });
    });

    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortInput = (query.sort ?? DEFAULT_SORT_FIELD).toLowerCase();

    const sortEntry = SORT_PARSER[sortInput];

    if (!sortEntry) {
      this.logger.warn(
        `Nieobsługiwany format sortowania: ${query.sort}, używam domyślnego.`
      );
    }

    const sortFieldKey = sortEntry?.field?.split(':')[0] ?? 'createdAt';
    const sortDirection = sortEntry?.direction ?? 'desc';
    const sortField = SORT_FIELD_MAP[sortFieldKey] ?? 'createdAt';

    this.logger.debug(
      `Pobieranie listy zamówień: actor=${user.actorId}, roles=${roles.join(
        ','
      )}, page=${page}, limit=${limit}, includeDeleted=${
        query.includeDeleted ?? false
      }`
    );

    try {
      return await this.repository.list(supabase, {
        page,
        limit,
        includeDeleted: query.includeDeleted ?? false,
        customerId: query.customerId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        sortField,
        sortDirection,
      });
    } catch (error) {
      this.logger.error('Nie udało się pobrać listy zamówień', error as Error);

      throw new InternalServerErrorException({
        code: 'ORDERS_LIST_FAILED',
        message: 'Nie udało się pobrać listy zamówień.',
      });
    }
  }

  async getById(
    id: string,
    user: CustomerMutatorContext
  ): Promise<OrderDetailDto> {
    if (!user) {
      throw new ForbiddenException('Brak uwierzytelnionego użytkownika.');
    }

    const roles = user.actorRoles ?? [];
    const isElevated = roles.some(
      (role) => role === 'editor' || role === 'owner'
    );

    const supabase = this.getSupabaseClientOrThrow(user.accessToken, () => {
      throw new InternalServerErrorException({
        code: 'ORDERS_SUPABASE_TOKEN_MISSING',
        message: 'Brak tokenu dostępowego użytkownika wykonującego operację.',
      });
    });

    this.logger.debug(
      `Pobieranie zamówienia: orderId=${id}, actor=${
        user.actorId
      }, roles=${roles.join(',')}`
    );

    try {
      const order = await this.repository.findById(supabase, id, {
        includeDeleted: isElevated,
      });

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: 'Nie znaleziono zamówienia.',
        });
      }

      if (order.deletedAt && !isElevated) {
        throw new ForbiddenException({
          code: 'ORDER_VIEW_FORBIDDEN',
          message: 'Brak uprawnień do podglądu usuniętego zamówienia.',
        });
      }

      return order;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error(
        `Nie udało się pobrać zamówienia ${id}`,
        error as Error
      );

      throw new InternalServerErrorException({
        code: 'ORDER_FETCH_FAILED',
        message: 'Nie udało się pobrać zamówienia.',
      });
    }
  }

  async create(
    command: CreateOrderCommand,
    user: CustomerMutatorContext
  ): Promise<OrderDetailDto> {
    if (!user) {
      throw new ForbiddenException('Brak uwierzytelnionego użytkownika.');
    }

    const roles = user.actorRoles ?? [];
    const hasMutationRole = roles.some(
      (role) => role === 'editor' || role === 'owner'
    );

    if (!hasMutationRole) {
      throw new ForbiddenException({
        code: 'ORDERS_CREATE_FORBIDDEN',
        message: 'Brak wymaganych ról do utworzenia zamówienia.',
      });
    }

    const supabase = this.getSupabaseClientOrThrow(user.accessToken, () => {
      throw new InternalServerErrorException({
        code: 'ORDERS_SUPABASE_TOKEN_MISSING',
        message: 'Brak tokenu dostępowego użytkownika wykonującego operację.',
      });
    });

    this.logger.debug(
      `Rozpoczynam tworzenie zamówienia ${command.orderNo} przez użytkownika ${user.actorId}.`
    );

    const normalizedCommand = this.normalizeCommand(command);

    this.validateCommand(normalizedCommand);

    try {
      const created = await this.repository.create(supabase, {
        command: normalizedCommand,
        actorId: user.actorId,
      });

      return created;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error('Nie udało się utworzyć zamówienia.', error as Error);

      throw new InternalServerErrorException({
        code: 'ORDERS_CREATE_FAILED',
        message: 'Nie udało się utworzyć zamówienia.',
      });
    }
  }

  async update(
    orderId: string,
    command: UpdateOrderCommand,
    user: CustomerMutatorContext
  ): Promise<OrderDetailDto> {
    if (!user) {
      throw new ForbiddenException('Brak uwierzytelnionego użytkownika.');
    }

    const roles = user.actorRoles ?? [];
    const hasMutationRole = roles.some(
      (role) => role === 'editor' || role === 'owner'
    );

    if (!hasMutationRole) {
      throw new ForbiddenException({
        code: 'ORDERS_UPDATE_FORBIDDEN',
        message: 'Brak wymaganych ról do aktualizacji zamówienia.',
      });
    }

    const actorId = user.actorId;

    if (!actorId) {
      throw new InternalServerErrorException({
        code: 'ORDERS_UPDATE_FAILED',
        message: 'Brak identyfikatora użytkownika wykonującego operację.',
      });
    }

    const supabase = this.getSupabaseClientOrThrow(user.accessToken, () => {
      throw new InternalServerErrorException({
        code: 'ORDERS_SUPABASE_TOKEN_MISSING',
        message: 'Brak tokenu dostępowego użytkownika wykonującego operację.',
      });
    });

    this.logger.debug(
      `Rozpoczynam aktualizację zamówienia ${this.maskOrderId(
        orderId
      )} przez użytkownika ${actorId}.`
    );

    const existing = await this.repository
      .findByIdForUpdate(supabase, orderId)
      .catch((error) => {
        this.logger.error(
          `Błąd pobierania zamówienia ${orderId} przed aktualizacją`,
          error as Error
        );

        throw new InternalServerErrorException({
          code: 'ORDERS_UPDATE_FAILED',
          message: 'Nie udało się przygotować aktualizacji zamówienia.',
        });
      });

    if (!existing) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Nie znaleziono zamówienia.',
      });
    }

    const normalizedCommand = this.normalizeCommand(command);

    this.validateCommand(normalizedCommand);

    try {
      return await this.repository.update(supabase, {
        orderId,
        command: normalizedCommand,
        actorId,
      });
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Nie udało się zaktualizować zamówienia ${orderId}`,
        error as Error
      );

      throw new InternalServerErrorException({
        code: 'ORDERS_UPDATE_FAILED',
        message: 'Nie udało się zaktualizować zamówienia.',
      });
    }
  }

  private normalizeCommand<T extends BaseOrderCommand>(command: T): T {
    const trimmedComment = command.comment?.trim() ?? undefined;
    const normalizedOrderNo = command.orderNo?.trim().toUpperCase();
    const normalizedItemName = command.itemName?.trim();
    const normalizedDeletedAt = command.deletedAt
      ? new Date(command.deletedAt).toISOString()
      : command.deletedAt ?? null;
    const producerDiscountPct = command.producerDiscountPct != null
      ? Math.max(0, Math.min(100, command.producerDiscountPct))
      : null;
    const distributorDiscountPct = command.distributorDiscountPct != null
      ? Math.max(0, Math.min(100, command.distributorDiscountPct))
      : null;
    const vatRatePct = command.vatRatePct != null
      ? Math.max(0, Math.min(100, command.vatRatePct))
      : null;
    const totalNetPln = command.totalNetPln != null
      ? Math.max(0, command.totalNetPln)
      : null;
    const totalGrossPln = command.totalGrossPln != null
      ? Math.max(0, command.totalGrossPln)
      : null;

    return {
      ...command,
      orderNo: normalizedOrderNo,
      itemName: normalizedItemName,
      comment: trimmedComment,
      deletedAt: normalizedDeletedAt,
      producerDiscountPct: producerDiscountPct,
      distributorDiscountPct: distributorDiscountPct,
      vatRatePct: vatRatePct,
      totalNetPln: totalNetPln,
      totalGrossPln: totalGrossPln,
    } as T;
  }

  private validateCommand(command: BaseOrderCommand): void {
    if (
      !this.areAmountsConsistent(command.totalNetPln, command.totalGrossPln, command.vatRatePct)
    ) {
      throw new BadRequestException({
        code: 'ORDERS_CREATE_VALIDATION',
        message:
          'Suma brutto w PLN musi mieścić się w tolerancji względem sumy netto.',
      });
    }
  }

  private areAmountsConsistent(a: number, b: number, vatRate: number): boolean {
    return Math.abs(a*(1+vatRate/100) - b) <= AMOUNT_TOLERANCE;
  }

  async delete(
    orderId: string,
    user: CustomerMutatorContext | null
  ): Promise<void> {
    if (!user) {
      throw new ForbiddenException({
        code: 'ORDERS_DELETE_FORBIDDEN',
        message: 'Brak wymaganych ról do usunięcia zamówienia.',
      });
    }

    const { actorId, actorRoles } = user;

    if (!actorId) {
      throw new InternalServerErrorException({
        code: 'ORDERS_DELETE_FAILED',
        message: 'Brak identyfikatora użytkownika wykonującego operację.',
      });
    }

    const supabase = this.getSupabaseClientOrThrow(user.accessToken, () => {
      throw new InternalServerErrorException({
        code: 'ORDERS_SUPABASE_TOKEN_MISSING',
        message: 'Brak tokenu dostępowego użytkownika wykonującego operację.',
      });
    });

    const hasDeleteRole = (actorRoles ?? []).some(
      (role) => role === 'editor' || role === 'owner'
    );

    if (!hasDeleteRole) {
      throw new ForbiddenException({
        code: 'ORDERS_DELETE_FORBIDDEN',
        message: 'Brak wymaganych ról do usunięcia zamówienia.',
      });
    }

    this.logger.debug(
      `Rozpoczęcie soft-delete zamówienia ${this.maskOrderId(
        orderId
      )} przez użytkownika ${actorId}`
    );

    let existing: OrderDetailDto | null;

    try {
      existing = await this.repository.findActiveById(supabase, orderId);
    } catch (error) {
      this.logger.error(
        `Błąd pobrania zamówienia ${orderId} przed usunięciem`,
        error as Error
      );

      throw new InternalServerErrorException({
        code: 'ORDERS_DELETE_FAILED',
        message: 'Nie udało się przygotować usunięcia zamówienia.',
      });
    }

    if (!existing) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Nie znaleziono zamówienia.',
      });
    }

    const command: DeleteOrderCommand = {
      orderId,
    };

    try {
      await this.repository.softDelete(supabase, { command, actorId });
    } catch (error) {
      this.logger.error(
        `Nie udało się usunąć zamówienia ${orderId}`,
        error as Error
      );

      throw new InternalServerErrorException({
        code: 'ORDERS_DELETE_FAILED',
        message: 'Nie udało się usunąć zamówienia.',
      });
    }

    this.logger.debug(
      `Soft-delete zamówienia ${this.maskOrderId(
        orderId
      )} zakończony powodzeniem`
    );
  }

  private getSupabaseClientOrThrow(
    accessToken: string | undefined,
    onMissing: () => never
  ): SupabaseClient<Database> {
    if (!accessToken) {
      onMissing();
    }

    return this.supabaseFactory.create(accessToken);
  }

  private maskOrderId(orderId: string): string {
    return `${orderId.substring(0, 8)}…`;
  }
}
