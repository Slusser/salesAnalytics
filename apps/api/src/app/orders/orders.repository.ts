import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert, TablesUpdate } from '@db/database.types';
import type {
  CreateOrderCommand,
  DeleteOrderCommand,
  ListOrdersResponse,
  OrderDetailDto,
  UpdateOrderCommand,
} from '@shared/dtos/orders.dto';
import {
  OrderMapper,
  type OrderDetailRow,
  type OrderListRow,
} from './order.mapper';
import { PostgrestError } from '@supabase/supabase-js';

interface ListParams {
  page: number;
  limit: number;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortField:
    | 'orderDate'
    | 'orderNo'
    | 'customerName'
    | 'totalNetPln'
    | 'createdAt';
  sortDirection: 'asc' | 'desc';
  includeDeleted: boolean;
}

interface FindByIdOptions {
  includeDeleted: boolean;
}

interface CreateParams {
  command: CreateOrderCommand;
  actorId: string;
}

interface UpdateParams {
  orderId: string;
  command: UpdateOrderCommand;
  actorId: string;
}

interface SoftDeleteParams {
  command: DeleteOrderCommand;
  actorId: string;
}

const SORT_FIELD_MAP: Record<ListParams['sortField'], string> = {
  orderDate: 'order_date',
  orderNo: 'order_no',
  customerName: 'customers(name)',
  totalNetPln: 'total_net_pln',
  createdAt: 'created_at',
};

type Supabase = SupabaseClient<Database>;

@Injectable()
export class OrdersRepository {
  private readonly logger = new Logger(OrdersRepository.name);

  async list(
    client: Supabase,
    params: ListParams
  ): Promise<ListOrdersResponse> {
    const offset = (params.page - 1) * params.limit;
    const baseQuery = client
      .from('orders')
      .select(
        'id, customer_id, order_no, order_date, item_name, quantity, is_eur, eur_rate, producer_discount_pct, distributor_discount_pct, vat_rate_pct, total_net_pln, total_gross_pln, total_gross_eur, comment, currency_code, created_by, created_at, updated_at, deleted_at' as const,
        { count: 'exact' }
      )
      .order(SORT_FIELD_MAP[params.sortField], {
        ascending: params.sortDirection === 'asc',
      })
      .range(offset, offset + params.limit - 1);

    let query = baseQuery;

    if (!params.includeDeleted) {
      query = query.is('deleted_at', null);
    }

    if (params.customerId) {
      query = query.eq('customer_id', params.customerId);
    }

    if (params.dateFrom) {
      query = query.gte('order_date', params.dateFrom);
    }

    if (params.dateTo) {
      query = query.lte('order_date', params.dateTo);
    }

    const { data, count, error } = await query;

    if (error) {
      this.logger.error('Nie udało się pobrać listy zamówień', error);
      throw error;
    }

    const items = (data ?? []).map((row) =>
      OrderMapper.toListDto(row as OrderListRow)
    );

    return {
      items,
      total: count ?? 0,
      page: params.page,
      limit: params.limit,
    };
  }

  async findById(
    client: Supabase,
    id: string,
    options: FindByIdOptions
  ): Promise<OrderDetailDto | null> {
    const { includeDeleted } = options;

    const baseQuery = client
      .from('orders')
      .select(
        'id, customer_id, order_no, order_date, item_name, quantity, is_eur, eur_rate, producer_discount_pct, distributor_discount_pct, vat_rate_pct, total_net_pln, total_gross_pln, total_gross_eur, comment, currency_code, created_by, created_at, updated_at, deleted_at' as const
      )
      .eq('id', id);

    const filteredQuery = includeDeleted
      ? baseQuery
      : baseQuery.is('deleted_at', null);

    const { data, error } = await filteredQuery.maybeSingle();

    if (error) {
      this.logger.error(`Nie udało się pobrać zamówienia ${id}`, error);
      throw error;
    }

    if (!data) {
      return null;
    }

    return OrderMapper.toDetailDto(data as OrderDetailRow);
  }

  async findActiveById(
    client: Supabase,
    id: string
  ): Promise<OrderDetailDto | null> {
    const { data, error } = await client
      .from('orders')
      .select(
        'id, order_no, order_date, item_name, quantity, is_eur, eur_rate, producer_discount_pct, distributor_discount_pct, vat_rate_pct, total_net_pln, total_gross_pln, total_gross_eur, comment, currency_code, created_by, created_at, updated_at, deleted_at' as const
      )
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Nie udało się pobrać aktywnego zamówienia ${id}`,
        error
      );
      throw error;
    }

    if (!data) {
      return null;
    }

    return OrderMapper.toDetailDto(data as OrderDetailRow);
  }

  async create(
    client: Supabase,
    params: CreateParams
  ): Promise<OrderDetailDto> {
    const { command, actorId } = params;

    const payload: TablesInsert<'orders'> = {
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
      created_by: actorId,
    };

    const { data, error } = await client
      .from('orders')
      .insert(payload)
      .select(
        'id, order_no, order_date, item_name, quantity, is_eur, eur_rate, producer_discount_pct, distributor_discount_pct, vat_rate_pct, total_net_pln, total_gross_pln, total_gross_eur, comment, currency_code, created_by, created_at, updated_at, deleted_at' as const
      )
      .single();

    if (error) {
      this.handleCreateError(error);
    }

    if (!data) {
      throw new Error('Brak danych utworzonego zamówienia.');
    }

    return OrderMapper.toDetailDto(data as OrderDetailRow);
  }

  private handleCreateError(error: PostgrestError): never {
    if (error.code === '23505') {
      throw new ConflictException({
        code: 'ORDERS_CREATE_CONFLICT',
        message: 'Zamówienie o podanym numerze już istnieje.',
      });
    }

    this.logger.error('Nie udało się utworzyć zamówienia', error);

    throw error;
  }

  async findByIdForUpdate(
    client: Supabase,
    orderId: string
  ): Promise<OrderDetailRow | null> {
    const { data, error } = await client
      .from('orders')
      .select(
        'id, order_no, order_date, item_name, quantity, is_eur, eur_rate, producer_discount_pct, distributor_discount_pct, vat_rate_pct, total_net_pln, total_gross_pln, total_gross_eur, comment, currency_code, created_by, created_at, updated_at, deleted_at' as const
      )
      .eq('id', orderId)
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Nie udało się pobrać zamówienia ${orderId} do aktualizacji`,
        error
      );
      throw error;
    }

    return (data as OrderDetailRow | null) ?? null;
  }

  async update(
    client: Supabase,
    params: UpdateParams
  ): Promise<OrderDetailDto> {
    const { command, orderId } = params;

    const payload: TablesUpdate<'orders'> = {
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
      deleted_at: command.deletedAt ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('orders')
      .update(payload)
      .eq('id', orderId)
      .select(
        'id, order_no, order_date, item_name, quantity, is_eur, eur_rate, producer_discount_pct, distributor_discount_pct, vat_rate_pct, total_net_pln, total_gross_pln, total_gross_eur, comment, currency_code, created_by, created_at, updated_at, deleted_at' as const
      )
      .maybeSingle();

    if (error) {
      this.handleUpdateError(error, orderId);
    }

    if (!data) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Nie znaleziono zamówienia.',
      });
    }

    return OrderMapper.toDetailDto(data as OrderDetailRow);
  }

  private handleUpdateError(error: PostgrestError, orderId: string): never {
    if (error.code === '23505') {
      throw new ConflictException({
        code: 'ORDERS_UPDATE_CONFLICT',
        message: 'Zamówienie o podanym numerze już istnieje.',
      });
    }

    this.logger.error(
      `Nie udało się zaktualizować zamówienia ${orderId}`,
      error
    );

    throw error;
  }

  async softDelete(client: Supabase, params: SoftDeleteParams): Promise<void> {
    const { command } = params;

    const payload: TablesUpdate<'orders'> = {
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await client
      .from('orders')
      .update(payload)
      .eq('id', command.orderId)
      .is('deleted_at', null);

    if (error) {
      this.logger.error(
        `Nie udało się soft-delete zamówienia ${command.orderId}`,
        error
      );
      throw error;
    }
  }
}
