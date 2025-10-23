import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { SupabaseClient } from 'apps/db/supabase.client'
import { supabaseClient } from 'apps/db/supabase.client'
import type { Tables } from 'apps/db/database.types'
import type {
  CreateOrderCommand,
  ListOrdersResponse,
  OrderDetailDto,
  UpdateOrderCommand
} from 'apps/shared/dtos/orders.dto'
import { OrderMapper, type OrderDetailRow, type OrderListRow } from './order.mapper'
import { PostgrestError } from '@supabase/supabase-js'

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

interface CreateParams {
  command: CreateOrderCommand
  actorId: string
}

interface UpdateParams {
  orderId: string
  command: UpdateOrderCommand
  actorId: string
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

  async create(params: CreateParams): Promise<OrderDetailDto> {
    const { command, actorId } = params

    const payload: Partial<Tables<'orders'>> = {
      order_no: command.orderNo,
      customer_id: command.customerId,
      order_date: command.orderDate,
      item_name: command.itemName,
      quantity: command.quantity,
      is_eur: command.isEur,
      eur_rate: command.eurRate ?? null,
      producer_discount_pct: command.producerDiscountPct,
      distributor_discount_pct: command.distributorDiscountPct,
      vat_rate_pct: command.vatRatePct,
      total_net_pln: command.totalNetPln,
      total_gross_pln: command.totalGrossPln,
      total_gross_eur: command.totalGrossEur ?? null,
      comment: command.comment ?? null,
      created_by: actorId
    }

    const { data, error } = await this.client
      .from('orders')
      .insert(payload)
      .select(
        `id, order_no, order_date, item_name, quantity, is_eur, eur_rate, producer_discount_pct, distributor_discount_pct, vat_rate_pct, total_net_pln, total_gross_pln, total_gross_eur, comment, currency_code, created_by, created_at, updated_at, deleted_at, customers:customers!inner(id, name), created_by_user:created_by!inner(id, display_name)` as const
      )
      .single()

    if (error) {
      this.handleCreateError(error)
    }

    if (!data) {
      throw new Error('Brak danych utworzonego zamówienia.')
    }

    return OrderMapper.toDetailDto(data as OrderDetailRow)
  }

  private handleCreateError(error: PostgrestError): never {
    if (error.code === '23505') {
      throw new ConflictException({
        code: 'ORDERS_CREATE_CONFLICT',
        message: 'Zamówienie o podanym numerze już istnieje.'
      })
    }

    this.logger.error('Nie udało się utworzyć zamówienia', error)

    throw error
  }

  async findByIdForUpdate(orderId: string): Promise<OrderDetailRow | null> {
    const { data, error } = await this.client
      .from('orders')
      .select(
        `id, order_no, order_date, item_name, quantity, is_eur, eur_rate, producer_discount_pct, distributor_discount_pct, vat_rate_pct, total_net_pln, total_gross_pln, total_gross_eur, comment, currency_code, created_by, created_at, updated_at, deleted_at, customers:customers!inner(id, name), created_by_user:created_by!inner(id, display_name)` as const
      )
      .eq('id', orderId)
      .maybeSingle()

    if (error) {
      this.logger.error(`Nie udało się pobrać zamówienia ${orderId} do aktualizacji`, error)
      throw error
    }

    return (data as OrderDetailRow | null) ?? null
  }

  async update(params: UpdateParams): Promise<OrderDetailDto> {
    const { command, orderId, actorId } = params

    const payload: Partial<Tables<'orders'>> = {
      order_no: command.orderNo,
      customer_id: command.customerId,
      order_date: command.orderDate,
      item_name: command.itemName,
      quantity: command.quantity,
      is_eur: command.isEur,
      eur_rate: command.eurRate ?? null,
      producer_discount_pct: command.producerDiscountPct,
      distributor_discount_pct: command.distributorDiscountPct,
      vat_rate_pct: command.vatRatePct,
      total_net_pln: command.totalNetPln,
      total_gross_pln: command.totalGrossPln,
      total_gross_eur: command.totalGrossEur ?? null,
      comment: command.comment ?? null,
      updated_at: new Date().toISOString()
    }

    const { data, error } = await this.client
      .from('orders')
      .update(payload)
      .eq('id', orderId)
      .select(
        `id, order_no, order_date, item_name, quantity, is_eur, eur_rate, producer_discount_pct, distributor_discount_pct, vat_rate_pct, total_net_pln, total_gross_pln, total_gross_eur, comment, currency_code, created_by, created_at, updated_at, deleted_at, customers:customers!inner(id, name), created_by_user:created_by!inner(id, display_name)` as const
      )
      .maybeSingle()

    if (error) {
      this.handleUpdateError(error, orderId)
    }

    if (!data) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Nie znaleziono zamówienia.'
      })
    }

    return OrderMapper.toDetailDto(data as OrderDetailRow)
  }

  private handleUpdateError(error: PostgrestError, orderId: string): never {
    if (error.code === '23505') {
      throw new ConflictException({
        code: 'ORDERS_UPDATE_CONFLICT',
        message: 'Zamówienie o podanym numerze już istnieje.'
      })
    }

    this.logger.error(`Nie udało się zaktualizować zamówienia ${orderId}`, error)

    throw error
  }
}


