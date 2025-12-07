import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PostgrestError } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  CreateCustomerCommand,
  CustomerDetailResponse,
  CustomerDto,
  CustomerMutatorContext,
  DeleteCustomerCommand,
  ListCustomersQuery,
  ListCustomersResponse,
  UpdateCustomerCommand,
} from '@shared/dtos/customers.dto';
import { CustomersRepository } from './customers.repository';
import { CustomerMapper } from './customers.mapper';
import type { Database } from '@db/database.types';
import { SupabaseFactory } from '../supabase/supabase.factory';

export class CustomerDuplicateNameError extends Error {
  readonly code = 'CUSTOMER_DUPLICATE_NAME';

  constructor(message = 'Klient o podanej nazwie już istnieje.') {
    super(message);
  }
}

export class CustomerCreateFailedError extends Error {
  readonly code = 'CUSTOMER_CREATE_FAILED';

  constructor(message = 'Nie udało się utworzyć klienta.') {
    super(message);
  }
}

export class CustomerUpdateFailedError extends Error {
  readonly code = 'CUSTOMER_UPDATE_FAILED';

  constructor(message = 'Nie udało się zaktualizować klienta.') {
    super(message);
  }
}

export class CustomersListFailedError extends Error {
  readonly code = 'CUSTOMERS_LIST_FAILED';

  constructor(message = 'Nie udało się pobrać listy klientów.') {
    super(message);
  }
}

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly repository: CustomersRepository,
    private readonly supabaseFactory: SupabaseFactory
  ) {}

  async list(
    query: ListCustomersQuery,
    context: CustomerMutatorContext
  ): Promise<ListCustomersResponse> {
    if (!context) {
      throw new CustomersListFailedError(
        'Brak kontekstu użytkownika wykonującego operację.'
      );
    }

    const supabase = this.getSupabaseClientOrThrow(
      context.accessToken,
      () => {
        throw new CustomersListFailedError(
          'Brak tokenu dostępowego użytkownika wykonującego operację.'
        );
      }
    );

    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const includeInactive = query.includeInactive ?? false;
    const search = query.search;

    const isViewerOnly = !context.actorRoles.some(
      (role) => role === 'editor' || role === 'owner'
    );
    if (includeInactive && isViewerOnly) {
      throw new ForbiddenException(
        'Brak wymaganych ról do wyświetlenia nieaktywnych klientów.'
      );
    }

    this.logger.debug(
      `Listing customers: page=${page}, limit=${limit}, includeInactive=${includeInactive}, hasSearch=${
        search ? 'true' : 'false'
      }`
    );

    try {
      return await this.repository.list(supabase, {
        page,
        limit,
        includeInactive,
        search,
      });
    } catch (error) {
      this.logger.error('Nie udało się pobrać listy klientów', error as Error);
      throw new CustomersListFailedError();
    }
  }

  async create(
    command: CreateCustomerCommand,
    context: CustomerMutatorContext
  ): Promise<CustomerDto> {
    if (!context) {
      throw new CustomerCreateFailedError(
        'Brak kontekstu użytkownika wykonującego operację.'
      );
    }

    const trimmedName = command.name.trim();
    if (!trimmedName) {
      throw new CustomerCreateFailedError('Nazwa klienta nie może być pusta.');
    }

    const isActive = command.isActive ?? true;
    const defaultDiscount = this.parseDiscountOrDefault(
      command.defaultDistributorDiscountPct,
      () => {
        throw new BadRequestException({
          code: 'CUSTOMER_VALIDATION_ERROR',
          message:
            'Domyślny rabat dystrybutora musi być liczbą w zakresie 0-100%.',
          details: [
            'Pole defaultDistributorDiscountPct musi być liczbą w zakresie 0-100%.',
          ],
        });
      }
    );
    const supabase = this.getSupabaseClientOrThrow(
      context.accessToken,
      () => {
        throw new CustomerCreateFailedError(
          'Brak tokenu dostępowego użytkownika wykonującego operację.'
        );
      }
    );

    try {
      const exists = await this.repository.isActiveNameTaken(
        supabase,
        trimmedName
      );
      if (exists) {
        throw new CustomerDuplicateNameError();
      }

      this.logger.debug(`Nazwa klienta "${trimmedName}" jest dostępna.`);
      this.logger.debug(
        `Rozpoczynam tworzenie klienta o nazwie "${trimmedName}" przez aktora ${context.actorId}.`
      );
      this.logger.debug(`Actor roles: ${context.actorRoles?.join(', ')}`);
      this.logger.debug(`Is active: ${isActive}`);
      this.logger.debug(
        `Default distributor discount: ${defaultDiscount.toFixed(2)}`
      );
      this.logger.debug(`Command: ${JSON.stringify(command)}`);
      this.logger.debug(`Context: ${JSON.stringify(context)}`);

      const result = await this.repository.insert(supabase, {
        name: trimmedName,
        isActive,
        actorId: context.actorId,
        defaultDistributorDiscountPct: defaultDiscount,
      });

      this.logger.debug(`Result: ${JSON.stringify(result)}`);

      if (result.error) {
        this.handleInsertError(result.error);
      }

      if (!result.data) {
        throw new CustomerCreateFailedError();
      }

      return result.data;
    } catch (error) {
      this.logger.error(
        `Nie udało się utworzyć klienta o nazwie "${trimmedName}" przez aktora ${context.actorId}.`,
        error instanceof Error ? error : undefined
      );

      throw error;
    }
  }

  async delete(
    command: DeleteCustomerCommand
  ): Promise<CustomerDetailResponse> {
    if (!command) {
      throw new InternalServerErrorException({
        code: 'CUSTOMERS_DELETE_FAILED',
        message: 'Brak danych polecenia usunięcia klienta.',
      });
    }

    const { customerId, actorId } = command;
    const actorRoles = command.actorRoles ?? [];

    if (!actorId) {
      throw new InternalServerErrorException({
        code: 'CUSTOMERS_DELETE_FAILED',
        message: 'Brak identyfikatora użytkownika wykonującego operację.',
      });
    }

    const supabase = this.getSupabaseClientOrThrow(command.accessToken, () => {
      throw new InternalServerErrorException({
        code: 'CUSTOMERS_DELETE_FAILED',
        message: 'Brak tokenu dostępowego użytkownika wykonującego operację.',
      });
    });

    const isAuthorized = actorRoles.some(
      (role) => role === 'editor' || role === 'owner'
    );

    if (!isAuthorized) {
      throw new ForbiddenException({
        code: 'CUSTOMERS_DELETE_FORBIDDEN',
        message: 'Brak wymaganych ról do usunięcia klienta.',
      });
    }

    this.logger.debug(
      `Rozpoczęcie soft-delete klienta ${customerId} przez użytkownika ${actorId}`
    );

    const existing = await this.repository.findById(supabase, customerId);

    if (existing.error) {
      this.logger.error(
        `Nie udało się pobrać klienta ${customerId} przed usunięciem`,
        existing.error
      );
      throw new InternalServerErrorException({
        code: 'CUSTOMERS_DELETE_FAILED',
        message: 'Nie udało się pobrać klienta.',
      });
    }

    const current = existing.data;

    if (!current) {
      throw new NotFoundException({
        code: 'CUSTOMERS_DELETE_NOT_FOUND',
        message: 'Klient nie został znaleziony.',
      });
    }

    if (current.deleted_at) {
      this.logger.debug(
        `Klient ${customerId} już usunięty - zwracam aktualny stan.`
      );
      return CustomerMapper.toDto(current);
    }

    const deletedAt = new Date().toISOString();

    const result = await this.repository.softDelete(supabase, {
      customerId,
      deletedAt,
    });

    if (result.error) {
      this.logger.error(
        `Nie udało się usunąć klienta ${customerId}`,
        result.error
      );
      throw this.toDeleteException(result.error);
    }

    if (!result.data) {
      throw new NotFoundException({
        code: 'CUSTOMERS_DELETE_NOT_FOUND',
        message: 'Klient nie został znaleziony.',
      });
    }

    this.logger.debug(`Pomyślnie usunięto klienta ${customerId}`);

    return result.data;
  }

  async getById(
    customerId: string,
    context: CustomerMutatorContext | null
  ): Promise<CustomerDetailResponse> {
    if (!context) {
      throw new InternalServerErrorException({
        code: 'CUSTOMERS_GET_BY_ID_FAILED',
        message: 'Brak kontekstu użytkownika wykonującego operację.',
      });
    }

    const supabase = this.getSupabaseClientOrThrow(
      context.accessToken,
      () => {
        throw new InternalServerErrorException({
          code: 'CUSTOMERS_GET_BY_ID_FAILED',
          message: 'Brak tokenu dostępowego użytkownika wykonującego operację.',
        });
      }
    );

    const { data, error } = await this.repository.findById(
      supabase,
      customerId
    );

    if (error) {
      this.logger.error(`Nie udało się pobrać klienta ${customerId}`, error);
      throw new InternalServerErrorException({
        code: 'CUSTOMERS_GET_BY_ID_FAILED',
        message: 'Nie udało się pobrać klienta.',
      });
    }

    if (!data) {
      throw new NotFoundException({
        code: 'CUSTOMERS_GET_BY_ID_NOT_FOUND',
        message: 'Klient nie został znaleziony.',
      });
    }

    const actorRoles = context.actorRoles ?? [];
    const canViewDeleted = actorRoles.some(
      (role) => role === 'editor' || role === 'owner'
    );

    if (data.deleted_at && !canViewDeleted) {
      throw new NotFoundException({
        code: 'CUSTOMERS_GET_BY_ID_NOT_FOUND',
        message: 'Klient nie został znaleziony.',
      });
    }

    this.logger.debug(
      `Pobieranie klienta o identyfikatorze ${customerId}, rola pozwala na usunięte: ${canViewDeleted}`
    );

    return CustomerMapper.toDto(data);
  }

  async update(
    customerId: string,
    command: UpdateCustomerCommand,
    context: CustomerMutatorContext | null
  ): Promise<CustomerDetailResponse> {
    if (!context) {
      throw new InternalServerErrorException({
        code: 'CUSTOMERS_UPDATE_FAILED',
        message: 'Brak kontekstu użytkownika wykonującego operację.',
      });
    }

    const supabase = this.getSupabaseClientOrThrow(
      context.accessToken,
      () => {
        throw new InternalServerErrorException({
          code: 'CUSTOMERS_UPDATE_FAILED',
          message: 'Brak tokenu dostępowego użytkownika wykonującego operację.',
        });
      }
    );

    const actorRoles = context.actorRoles ?? [];
    const hasMutationRole = actorRoles.some(
      (role) => role === 'editor' || role === 'owner'
    );

    if (!hasMutationRole) {
      throw new ForbiddenException({
        code: 'CUSTOMERS_UPDATE_FORBIDDEN',
        message: 'Brak wymaganych ról do aktualizacji klienta.',
      });
    }

    this.logger.debug(`Rozpoczęcie aktualizacji klienta ${customerId}`);

    const existing = await this.repository.findById(supabase, customerId);

    if (existing.error) {
      this.logger.error(
        `Nie udało się pobrać klienta ${customerId} przed aktualizacją`,
        existing.error
      );
      throw new InternalServerErrorException({
        code: 'CUSTOMERS_UPDATE_FAILED',
        message: 'Nie udało się pobrać klienta.',
      });
    }

    if (!existing.data) {
      throw new NotFoundException({
        code: 'CUSTOMERS_UPDATE_NOT_FOUND',
        message: 'Klient nie został znaleziony.',
      });
    }

    const currentCustomer = existing.data;

    const isCurrentlyDeleted = Boolean(currentCustomer.deleted_at);

    if (isCurrentlyDeleted && command.isActive !== true) {
      throw new NotFoundException({
        code: 'CUSTOMERS_UPDATE_NOT_FOUND',
        message: 'Klient nie został znaleziony.',
      });
    }

    const trimmedName = command.name?.trim();
    const nextName = trimmedName ?? undefined;
    const nextIsActive = command.isActive ?? currentCustomer.is_active;
    const requestedDeletedAt = command.deletedAt;
    const nextDeletedAtCandidate =
      requestedDeletedAt ?? currentCustomer.deleted_at;
    const nextDefaultDiscount = this.parseDiscountOptional(
      command.defaultDistributorDiscountPct,
      () => {
        throw new BadRequestException({
          code: 'CUSTOMERS_UPDATE_VALIDATION',
          message:
            'Domyślny rabat dystrybutora musi być liczbą w zakresie 0-100%.',
          details: [
            'Pole defaultDistributorDiscountPct musi być liczbą w zakresie 0-100%.',
          ],
        });
      }
    );

    if (nextName === '') {
      throw new BadRequestException({
        code: 'CUSTOMERS_UPDATE_VALIDATION',
        message: 'Pole name nie może być puste.',
      });
    }

    if (nextDeletedAtCandidate !== null && nextIsActive === false) {
      throw new BadRequestException({
        code: 'CUSTOMERS_UPDATE_VALIDATION',
        message: 'deletedAt może być ustawione tylko, gdy isActive==false.',
      });
    }

    const shouldCloseCustomer = command.isActive === false;
    const shouldRestoreCustomer = command.isActive === true;
    let computedDeletedAt = nextDeletedAtCandidate;

    if (shouldCloseCustomer && requestedDeletedAt === undefined) {
      computedDeletedAt = new Date().toISOString();
    }

    if (shouldRestoreCustomer) {
      computedDeletedAt = null;
    }

    if (
      nextName &&
      nextName.toLowerCase() !== currentCustomer.name.toLowerCase()
    ) {
      const nameTaken = await this.repository.isActiveNameTakenByOther(
        supabase,
        nextName,
        customerId
      );

      if (nameTaken) {
        throw new BadRequestException({
          code: 'CUSTOMERS_NAME_TAKEN',
          message: 'Klient o podanej nazwie już istnieje.',
        });
      }
    }

    const shouldUpdateDeletedAt =
      command.isActive !== undefined || requestedDeletedAt !== undefined;

    const updatePayload: UpdateCustomerCommand = {
      name: nextName ?? undefined,
      isActive: command.isActive,
      deletedAt: shouldUpdateDeletedAt ? computedDeletedAt : undefined,
      ...(nextDefaultDiscount !== undefined
        ? { defaultDistributorDiscountPct: nextDefaultDiscount }
        : {}),
    };

    const result = await this.repository.update(supabase, {
      customerId,
      ...updatePayload,
    });

    if (result.error) {
      this.logger.error(
        `Nie udało się zaktualizować klienta ${customerId}`,
        result.error
      );
      throw new InternalServerErrorException({
        code: 'CUSTOMERS_UPDATE_FAILED',
        message: 'Nie udało się zaktualizować klienta.',
      });
    }

    if (!result.data) {
      throw new NotFoundException({
        code: 'CUSTOMERS_UPDATE_NOT_FOUND',
        message: 'Klient nie został znaleziony.',
      });
    }

    this.logger.debug(`Pomyślnie zaktualizowano klienta ${customerId}`);

    return result.data;
  }

  private validateDiscount(
    value: number,
    onInvalid: () => never
  ): number {
    if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
      onInvalid();
    }

    if (value < 0 || value > 100) {
      onInvalid();
    }

    return Number(value);
  }

  private parseDiscountOrDefault(
    value: number | undefined,
    onInvalid: () => never,
    defaultValue = 0
  ): number {
    if (value === undefined) {
      return defaultValue;
    }

    if (value === null) {
      onInvalid();
    }

    return this.validateDiscount(value as number, onInvalid);
  }

  private parseDiscountOptional(
    value: number | undefined,
    onInvalid: () => never
  ): number | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      onInvalid();
    }

    return this.validateDiscount(value as number, onInvalid);
  }

  private handleInsertError(error: PostgrestError): never {
    if (error.code === '23505') {
      // unique_violation
      throw new CustomerDuplicateNameError();
    }

    this.logger.error('Nie udało się utworzyć klienta', error);
    throw new CustomerCreateFailedError();
  }

  private toDeleteException(
    _error: PostgrestError
  ): InternalServerErrorException {
    return new InternalServerErrorException({
      code: 'CUSTOMERS_DELETE_FAILED',
      message: 'Nie udało się usunąć klienta.',
    });
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
}
