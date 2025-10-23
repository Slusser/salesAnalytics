import { Injectable, Logger } from '@nestjs/common'
import type { SupabaseClient } from 'apps/db/supabase.client'
import { supabaseClient } from 'apps/db/supabase.client'
import type { Tables } from 'apps/db/database.types'
import type { ListOrdersResponse, OrderDetailDto } from 'apps/shared/dtos/orders.dto'
import { OrderMapper, type OrderDetailRow, type OrderListRow } from './order.mapper'

interface ListParams {
  page: number
  limit: number
  customerId?: string
  dateFrom?: string
  dateTo?: string
  sortField: 'orderDate' | 'orderNo' | 'customerName' | 'totalNetPln' | 'createdAt'
  sortDirection: 'asc' | 'desc'
  includeDeleted: boolean
}

interface FindByIdOptions {
  includeDeleted: boolean
}

const SORT_FIELD_MAP: Record<ListParams['sortField'], string> = {
  orderDate: 'order_date',
  orderNo: 'order_no',
  customerName: 'customers(name)',
  totalNetPln: 'total_net_pln',
  createdAt: 'created_at'
}

@Injectable()
export class OrdersRepository {
  private readonly client: SupabaseClient = supabaseClient
  private readonly logger = new Logger(OrdersRepository.name)

  async list(params: ListParams): Promise<ListOrdersResponse> {
    const offset = (params.page - 1) * params.limit
    const baseQuery = this.client
      .from('orders')
      .select(
        `id, order_no, order_date, item_name, quantity, is_eur, eur_rate, producer_discount_pct, distributor_discount_pct, vat_rate_pct, total_net_pln, total_gross_pln, total_gross_eur, comment, currency_code, created_by, created_at, updated_at, deleted_at, customers:customers(id, name), created_by_user:created_by(id, display_name)` as const,
        { count: 'exact' }
      )
      .order(SORT_FIELD_MAP[params.sortField], { ascending: params.sortDirection === 'asc' })
      .range(offset, offset + params.limit - 1)

    let query = baseQuery

    if (!params.includeDeleted) {
      query = query.is('deleted_at', null)
    }

    if (params.customerId) {
      query = query.eq('customer_id', params.customerId)
    }

    if (params.dateFrom) {
      query = query.gte('order_date', params.dateFrom)
    }

    if (params.dateTo) {
      query = query.lte('order_date', params.dateTo)
    }

    const { data, count, error } = await query

    if (error) {
      this.logger.error('Nie udało się pobrać listy zamówień', error)
      throw error
    }

    const items = (data ?? []).map((row) => OrderMapper.toListDto(row as OrderListRow))

    return {
      items,
      total: count ?? 0,
      page: params.page,
      limit: params.limit
    }
  }

  async findById(id: string, options: FindByIdOptions): Promise<OrderDetailDto | null> {
    const { includeDeleted } = options

    let query = this.client
      .from('orders')
      .select(
        `id, order_no, order_date, item_name, quantity, is_eur, eur_rate, producer_discount_pct, distributor_discount_pct, vat_rate_pct, total_net_pln, total_gross_pln, total_gross_eur, comment, currency_code, created_by, created_at, updated_at, deleted_at, customers:customers!inner(id, name), created_by_user:created_by!inner(id, display_name)` as const
      )
      .eq('id', id)
      .maybeSingle()

    if (!includeDeleted) {
      query = query.is('deleted_at', null)
    }

    const { data, error } = await query

    if (error) {
      this.logger.error(`Nie udało się pobrać zamówienia ${id}`, error)
      throw error
    }

    if (!data) {
      return null
    }

    return OrderMapper.toDetailDto(data as OrderDetailRow)
  }
}


