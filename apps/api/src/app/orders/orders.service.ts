import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException
} from '@nestjs/common'

import type { CustomerMutatorContext } from 'apps/shared/dtos/customers.dto'
import type {
  CreateOrderCommand,
  DeleteOrderCommand,
  ListOrdersQuery,
  ListOrdersResponse,
  OrderDetailDto,
  UpdateOrderCommand
} from 'apps/shared/dtos/orders.dto'
import { OrdersRepository } from './orders.repository'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 25
const DEFAULT_SORT_FIELD: ListOrdersQuery['sort'] = 'createdAt:desc'

const AMOUNT_TOLERANCE = 0.01

const SORT_PARSER: Record<string, { field: ListOrdersQuery['sort']; direction: 'asc' | 'desc' }> = {
  'createdat:asc': { field: 'createdAt:asc', direction: 'asc' },
  'createdat:desc': { field: 'createdAt:desc', direction: 'desc' },
  'orderdate:asc': { field: 'orderDate:asc', direction: 'asc' },
  'orderdate:desc': { field: 'orderDate:desc', direction: 'desc' },
  'orderno:asc': { field: 'orderNo:asc', direction: 'asc' },
  'orderno:desc': { field: 'orderNo:desc', direction: 'desc' },
  'customername:asc': { field: 'customerName:asc', direction: 'asc' },
  'customername:desc': { field: 'customerName:desc', direction: 'desc' },
  'totalnetpln:asc': { field: 'totalNetPln:asc', direction: 'asc' },
  'totalnetpln:desc': { field: 'totalNetPln:desc', direction: 'desc' }
}

const SORT_FIELD_MAP: Record<string, 'orderDate' | 'orderNo' | 'customerName' | 'totalNetPln' | 'createdAt'> = {
  createdAt: 'createdAt',
  orderDate: 'orderDate',
  orderNo: 'orderNo',
  customerName: 'customerName',
  totalNetPln: 'totalNetPln'
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name)

  constructor(private readonly repository: OrdersRepository) {}

  async list(query: ListOrdersQuery, user: CustomerMutatorContext): Promise<ListOrdersResponse> {
    if (!user) {
      throw new ForbiddenException('Brak uwierzytelnionego użytkownika.')
    }

    const roles = user.actorRoles ?? []
    const isElevated = roles.some((role) => role === 'editor' || role === 'owner')

    if (query.includeDeleted && !isElevated) {
      throw new ForbiddenException('Brak uprawnień do przeglądania usuniętych zamówień.')
    }

    const page = query.page ?? DEFAULT_PAGE
    const limit = query.limit ?? DEFAULT_LIMIT
    const sortInput = (query.sort ?? DEFAULT_SORT_FIELD).toLowerCase()

    const sortEntry = SORT_PARSER[sortInput]

    if (!sortEntry) {
      this.logger.warn(`Nieobsługiwany format sortowania: ${query.sort}, używam domyślnego.`)
    }

    const sortFieldKey = sortEntry?.field.split(':')[0] ?? 'createdAt'
    const sortDirection = sortEntry?.direction ?? 'desc'
    const sortField = SORT_FIELD_MAP[sortFieldKey] ?? 'createdAt'

    this.logger.debug(
      `Pobieranie listy zamówień: actor=${user.actorId}, roles=${roles.join(',')}, page=${page}, limit=${limit}, includeDeleted=${query.includeDeleted ?? false}`
    )

    try {
      return await this.repository.list({
        page,
        limit,
        includeDeleted: query.includeDeleted ?? false,
        customerId: query.customerId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        sortField,
        sortDirection
      })
    } catch (error) {
      this.logger.error('Nie udało się pobrać listy zamówień', error as Error)

      throw new InternalServerErrorException({
        code: 'ORDERS_LIST_FAILED',
        message: 'Nie udało się pobrać listy zamówień.'
      })
    }
  }

  async getById(id: string, user: CustomerMutatorContext): Promise<OrderDetailDto> {
    if (!user) {
      throw new ForbiddenException('Brak uwierzytelnionego użytkownika.')
    }

    const roles = user.actorRoles ?? []
    const isElevated = roles.some((role) => role === 'editor' || role === 'owner')

    this.logger.debug(
      `Pobieranie zamówienia: orderId=${id}, actor=${user.actorId}, roles=${roles.join(',')}`
    )

    try {
      const order = await this.repository.findById(id, { includeDeleted: isElevated })

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: 'Nie znaleziono zamówienia.'
        })
      }

      if (order.deletedAt && !isElevated) {
        throw new ForbiddenException({
          code: 'ORDER_VIEW_FORBIDDEN',
          message: 'Brak uprawnień do podglądu usuniętego zamówienia.'
        })
      }

      return order
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error
      }

      this.logger.error(`Nie udało się pobrać zamówienia ${id}`, error as Error)

      throw new InternalServerErrorException({
        code: 'ORDER_FETCH_FAILED',
        message: 'Nie udało się pobrać zamówienia.'
      })
    }
  }

  async create(command: CreateOrderCommand, user: CustomerMutatorContext): Promise<OrderDetailDto> {
    if (!user) {
      throw new ForbiddenException('Brak uwierzytelnionego użytkownika.')
    }

    const roles = user.actorRoles ?? []
    const hasMutationRole = roles.some((role) => role === 'editor' || role === 'owner')

    if (!hasMutationRole) {
      throw new ForbiddenException({
        code: 'ORDERS_CREATE_FORBIDDEN',
        message: 'Brak wymaganych ról do utworzenia zamówienia.'
      })
    }

    this.logger.debug(`Rozpoczynam tworzenie zamówienia ${command.orderNo} przez użytkownika ${user.actorId}.`)

    const normalizedCommand = this.normalizeCommand(command)

    this.validateCommand(normalizedCommand)

    try {
      const created = await this.repository.create({
        command: normalizedCommand,
        actorId: user.actorId
      })

      return created
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error
      }

      if (error instanceof BadRequestException) {
        throw error
      }

      this.logger.error('Nie udało się utworzyć zamówienia.', error as Error)

      throw new InternalServerErrorException({
        code: 'ORDERS_CREATE_FAILED',
        message: 'Nie udało się utworzyć zamówienia.'
      })
    }
  }

  private normalizeCommand(command: CreateOrderCommand): CreateOrderCommand {
    const trimmedComment = command.comment?.trim() || undefined
    const normalizedOrderNo = command.orderNo.trim().toUpperCase()
    const normalizedItemName = command.itemName.trim()

    return {
      ...command,
      orderNo: normalizedOrderNo,
      itemName: normalizedItemName,
      comment: trimmedComment
    }
  }

  private validateCommand(command: CreateOrderCommand): void {
    if (command.isEur) {
      if (command.eurRate === undefined) {
        throw new BadRequestException({
          code: 'ORDERS_CREATE_VALIDATION',
          message: 'Pole eurRate jest wymagane, gdy zamówienie rozliczane jest w EUR.'
        })
      }

      if (command.totalGrossEur === undefined) {
        throw new BadRequestException({
          code: 'ORDERS_CREATE_VALIDATION',
          message: 'Pole totalGrossEur jest wymagane, gdy zamówienie rozliczane jest w EUR.'
        })
      }
    } else {
      if (command.eurRate !== undefined || command.totalGrossEur !== undefined) {
        throw new BadRequestException({
          code: 'ORDERS_CREATE_VALIDATION',
          message: 'Pola eurRate i totalGrossEur są dozwolone tylko, gdy zamówienie rozliczane jest w EUR.'
        })
      }
    }

    if (!this.areAmountsConsistent(command.totalNetPln, command.totalGrossPln)) {
      throw new BadRequestException({
        code: 'ORDERS_CREATE_VALIDATION',
        message: 'Suma brutto w PLN musi mieścić się w tolerancji względem sumy netto.'
      })
    }

    if (command.isEur && command.totalGrossEur !== undefined) {
      const expectedGrossEur = command.totalGrossPln / command.eurRate!

      if (!this.areAmountsConsistent(expectedGrossEur, command.totalGrossEur)) {
        throw new BadRequestException({
          code: 'ORDERS_CREATE_VALIDATION',
          message: 'Suma brutto w EUR niezgodna z wartością przeliczoną z PLN.'
        })
      }
    }
  }

  private areAmountsConsistent(a: number, b: number): boolean {
    return Math.abs(a - b) <= AMOUNT_TOLERANCE
  }

  async delete(orderId: string, user: CustomerMutatorContext | null): Promise<void> {
    if (!user) {
      throw new ForbiddenException({
        code: 'ORDERS_DELETE_FORBIDDEN',
        message: 'Brak wymaganych ról do usunięcia zamówienia.'
      })
    }

    const { actorId, actorRoles } = user

    if (!actorId) {
      throw new InternalServerErrorException({
        code: 'ORDERS_DELETE_FAILED',
        message: 'Brak identyfikatora użytkownika wykonującego operację.'
      })
    }

    const hasDeleteRole = (actorRoles ?? []).some((role) => role === 'editor' || role === 'owner')

    if (!hasDeleteRole) {
      throw new ForbiddenException({
        code: 'ORDERS_DELETE_FORBIDDEN',
        message: 'Brak wymaganych ról do usunięcia zamówienia.'
      })
    }

    this.logger.debug(
      `Rozpoczęcie soft-delete zamówienia ${this.maskOrderId(orderId)} przez użytkownika ${actorId}`
    )

    let existing: OrderDetailDto | null

    try {
      existing = await this.repository.findActiveById(orderId)
    } catch (error) {
      this.logger.error(`Błąd pobrania zamówienia ${orderId} przed usunięciem`, error as Error)

      throw new InternalServerErrorException({
        code: 'ORDERS_DELETE_FAILED',
        message: 'Nie udało się przygotować usunięcia zamówienia.'
      })
    }

    if (!existing) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Nie znaleziono zamówienia.'
      })
    }

    const command: DeleteOrderCommand = {
      orderId
    }

    try {
      await this.repository.softDelete({ command, actorId })
    } catch (error) {
      this.logger.error(`Nie udało się usunąć zamówienia ${orderId}`, error as Error)

      throw new InternalServerErrorException({
        code: 'ORDERS_DELETE_FAILED',
        message: 'Nie udało się usunąć zamówienia.'
      })
    }

    this.logger.debug(`Soft-delete zamówienia ${this.maskOrderId(orderId)} zakończony powodzeniem`)
  }

  private maskOrderId(orderId: string): string {
    return `${orderId.substring(0, 8)}…`
  }
}


