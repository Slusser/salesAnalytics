import { ForbiddenException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common'

import type { CustomerMutatorContext } from 'apps/shared/dtos/customers.dto'
import type { ListOrdersQuery, ListOrdersResponse } from 'apps/shared/dtos/orders.dto'
import { OrdersRepository } from './orders.repository'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 25
const DEFAULT_SORT_FIELD: ListOrdersQuery['sort'] = 'createdAt:desc'

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
}


