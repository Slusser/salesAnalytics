import { Injectable, Logger } from '@nestjs/common'
import type { PostgrestError } from '@supabase/supabase-js'

import type { SupabaseClient } from 'apps/db/supabase.client'
import { supabaseClient } from 'apps/db/supabase.client'
import type { Tables } from 'apps/db/database.types'
import type { ListOrdersResponse, OrderListItemDto } from 'apps/shared/dtos/orders.dto'

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

interface SupabaseOrderRow extends Tables<'orders'> {
  customers: Pick<Tables<'customers'>, 'id' | 'name'>
  created_by_user: {
    id: string
    display_name: string | null
  }
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
        `id, order_no, order_date, item_name, quantity, is_eur, eur_rate, producer_discount_pct, distributor_discount_pct, vat_rate_pct, total_net_pln, total_gross_pln, total_gross_eur, created_at, updated_at, deleted_at, customers:customers(id, name), created_by_user:created_by(id, display_name)` as const,
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

    const items = (data ?? []).map((row) => this.mapRowToDto(row as SupabaseOrderRow))

    return {
      items,
      total: count ?? 0,
      page: params.page,
      limit: params.limit
    }
  }

  private mapRowToDto(row: SupabaseOrderRow): OrderListItemDto {
    const createdBy = row.created_by_user

    if (!createdBy) {
      this.logger.warn(`Rekord zamówienia ${row.id} nie zawiera danych o użytkowniku tworzącym.`)
    }

    return {
      id: row.id,
      orderNo: row.order_no,
      customer: {
        id: row.customers.id,
        name: row.customers.name
      },
      orderDate: row.order_date,
      itemName: row.item_name,
      quantity: row.quantity,
      isEur: row.is_eur,
      eurRate: row.eur_rate,
      producerDiscountPct: row.producer_discount_pct,
      distributorDiscountPct: row.distributor_discount_pct,
      vatRatePct: row.vat_rate_pct,
      totalNetPln: row.total_net_pln,
      totalGrossPln: row.total_gross_pln,
      totalGrossEur: row.total_gross_eur,
      createdBy: {
        id: createdBy?.id ?? row.created_by,
        displayName: createdBy?.display_name ?? 'Nieznany użytkownik'
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at
    }
  }
}


