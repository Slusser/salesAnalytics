import { Injectable, Logger } from '@nestjs/common';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import type {
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
} from '@db/database.types';
import { CustomerMapper } from './customers.mapper';
import type {
  CustomerDto,
  DeleteCustomerCommand,
  ListCustomersQuery,
  ListCustomersResponse,
  UpdateCustomerCommand,
} from '@shared/dtos/customers.dto';

interface InsertCustomerParams {
  name: string;
  isActive: boolean;
  actorId: string;
  defaultDistributorDiscountPct: number;
}

interface ListParams
  extends Required<Pick<ListCustomersQuery, 'page' | 'limit'>> {
  search?: string;
  includeInactive: boolean;
}

interface UpdateCustomerParams extends UpdateCustomerCommand {
  customerId: string;
}

type SoftDeleteParams = Pick<DeleteCustomerCommand, 'customerId'> & {
  deletedAt: string;
};

type Supabase = SupabaseClient<Database>;

@Injectable()
export class CustomersRepository {
  private readonly logger = new Logger(CustomersRepository.name);

  async isActiveNameTaken(client: Supabase, name: string): Promise<boolean> {
    const normalized = name.trim();
    const pattern = normalized.replace(/[%_]/g, '\\$&');

    const { count, error } = await client
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .ilike('name', pattern);

    if (error) {
      throw error;
    }

    return (count ?? 0) > 0;
  }

  async insert(
    client: Supabase,
    customer: InsertCustomerParams
  ): Promise<{ data?: CustomerDto; error?: PostgrestError }> {
    const payload: TablesInsert<'customers'> = {
      name: customer.name,
      is_active: customer.isActive,
      default_distributor_discount_pct: customer.defaultDistributorDiscountPct,
    };

    const { data, error } = await client
      .from('customers')
      .insert(payload)
      .select()
      .maybeSingle();

    if (error) {
      return { error };
    }

    if (!data) {
      this.logger.error('Brak danych zwróconych po wstawieniu klienta');
      return {};
    }

    return { data: CustomerMapper.toDto(data) };
  }

  async findById(
    client: Supabase,
    customerId: string
  ): Promise<{
    data?: Tables<'customers'> | null;
    error?: PostgrestError;
  }> {
    const { data, error } = await client
      .from('customers')
      .select(
        'id, name, is_active, default_distributor_discount_pct, created_at, updated_at, deleted_at'
      )
      .eq('id', customerId)
      .maybeSingle();

    if (error) {
      this.logger.error(`Błąd podczas pobierania klienta ${customerId}`, error);
      return { error };
    }

    return { data: (data as Tables<'customers'> | null) ?? null };
  }

  async isActiveNameTakenByOther(
    client: Supabase,
    name: string,
    excludingCustomerId: string
  ): Promise<boolean> {
    const normalized = name.trim();
    const pattern = normalized.replace(/[%_]/g, '\\$&');

    const { count, error } = await client
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .ilike('name', pattern)
      .neq('id', excludingCustomerId);

    if (error) {
      throw error;
    }

    return (count ?? 0) > 0;
  }

  async softDelete(
    client: Supabase,
    params: SoftDeleteParams
  ): Promise<{
    data?: CustomerDto | null;
    error?: PostgrestError;
  }> {
    const payload: TablesUpdate<'customers'> = {
      is_active: false,
      deleted_at: params.deletedAt,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('customers')
      .update(payload)
      .eq('id', params.customerId)
      .select(
        'id, name, is_active, default_distributor_discount_pct, created_at, updated_at, deleted_at'
      )
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Błąd podczas soft-delete klienta ${params.customerId}`,
        error
      );
      return { error };
    }

    if (!data) {
      return { data: null };
    }

    return { data: CustomerMapper.toDto(data as Tables<'customers'>) };
  }

  async update(
    client: Supabase,
    params: UpdateCustomerParams
  ): Promise<{
    data?: CustomerDto | null;
    error?: PostgrestError;
  }> {
    const payload: TablesUpdate<'customers'> = {};

    if (params.name !== undefined) {
      payload.name = params.name;
    }

    if (params.isActive !== undefined) {
      payload.is_active = params.isActive;
    }

    if (params.deletedAt !== undefined) {
      payload.deleted_at = params.deletedAt;
    }

    if (params.defaultDistributorDiscountPct !== undefined) {
      payload.default_distributor_discount_pct =
        params.defaultDistributorDiscountPct;
    }

    const { data, error } = await client
      .from('customers')
      .update(payload)
      .eq('id', params.customerId)
      .select(
        'id, name, is_active, default_distributor_discount_pct, created_at, updated_at, deleted_at'
      )
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Błąd podczas aktualizacji klienta ${params.customerId}`,
        error
      );
      return { error };
    }

    if (!data) {
      return { data: null };
    }

    return { data: CustomerMapper.toDto(data as Tables<'customers'>) };
  }

  async list(
    client: Supabase,
    params: ListParams
  ): Promise<ListCustomersResponse> {
    const { page, limit, search, includeInactive } = params;
    const offset = (page - 1) * limit;

    let query = client
      .from('customers')
      .select(
        'id, name, is_active, default_distributor_discount_pct, created_at, updated_at, deleted_at',
        {
          count: 'exact',
        }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (!includeInactive) {
      query = query.is('deleted_at', null).eq('is_active', true);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, count, error } = await query;

    if (error) {
      this.logger.error('Błąd podczas pobierania listy klientów', error);
      throw error;
    }

    const items = (data ?? []).map((row) =>
      CustomerMapper.toDto(row as Tables<'customers'>)
    );

    return {
      items,
      total: count ?? 0,
      page,
      limit,
    };
  }
}
