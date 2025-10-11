import { Injectable, Logger } from '@nestjs/common'
import type { PostgrestError } from '@supabase/supabase-js'

import type { Tables, TablesInsert, TablesUpdate } from 'apps/db/database.types'
import { supabaseClient } from 'apps/db/supabase.client'
import { CustomerMapper } from './customers.mapper'
import type {
  CustomerDto,
  ListCustomersQuery,
  ListCustomersResponse,
  UpdateCustomerCommand
} from 'apps/shared/dtos/customers.dto'

interface InsertCustomerParams {
  name: string
  isActive: boolean
  actorId: string
}

interface ListParams extends Required<Pick<ListCustomersQuery, 'page' | 'limit'>> {
  search?: string
  includeInactive: boolean
}

interface UpdateCustomerParams extends UpdateCustomerCommand {
  customerId: string
}

@Injectable()
export class CustomersRepository {
  private readonly client = supabaseClient
  private readonly logger = new Logger(CustomersRepository.name)

  async isActiveNameTaken(name: string): Promise<boolean> {
    const normalized = name.trim().toLowerCase()

    const { count, error } = await this.client
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .filter('deleted_at', 'is', null)
      .filter('lower(name)', 'eq', normalized)

    if (error) {
      throw error
    }

    return (count ?? 0) > 0
  }

  async insert(customer: InsertCustomerParams): Promise<{ data?: CustomerDto; error?: PostgrestError }> {
    const payload: TablesInsert<'customers'> = {
      name: customer.name,
      is_active: customer.isActive,
      deleted_at: customer.isActive ? null : new Date().toISOString()
    }

    const { data, error } = await this.client
      .from('customers')
      .insert(payload)
      .select()
      .maybeSingle()

    if (error) {
      return { error }
    }

    return { data: CustomerMapper.toDto(data) }
  }

  async findById(customerId: string): Promise<{
    data?: Tables<'customers'> | null
    error?: PostgrestError
  }> {
    const { data, error } = await this.client
      .from('customers')
      .select('id, name, is_active, created_at, updated_at, deleted_at')
      .eq('id', customerId)
      .maybeSingle()

    if (error) {
      this.logger.error(`Błąd podczas pobierania klienta ${customerId}`, error)
      return { error }
    }

    return { data: (data as Tables<'customers'> | null) ?? null }
  }

  async isActiveNameTakenByOther(name: string, excludingCustomerId: string): Promise<boolean> {
    const normalized = name.trim().toLowerCase()

    const { count, error } = await this.client
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .filter('deleted_at', 'is', null)
      .filter('lower(name)', 'eq', normalized)
      .neq('id', excludingCustomerId)

    if (error) {
      throw error
    }

    return (count ?? 0) > 0
  }

  async update(params: UpdateCustomerParams): Promise<{
    data?: CustomerDto | null
    error?: PostgrestError
  }> {
    const payload: TablesUpdate<'customers'> = {}

    if (params.name !== undefined) {
      payload.name = params.name
    }

    if (params.isActive !== undefined) {
      payload.is_active = params.isActive
    }

    if (params.deletedAt !== undefined) {
      payload.deleted_at = params.deletedAt
    }

    const { data, error } = await this.client
      .from('customers')
      .update(payload)
      .eq('id', params.customerId)
      .select('id, name, is_active, created_at, updated_at, deleted_at')
      .maybeSingle()

    if (error) {
      this.logger.error(`Błąd podczas aktualizacji klienta ${params.customerId}`, error)
      return { error }
    }

    if (!data) {
      return { data: null }
    }

    return { data: CustomerMapper.toDto(data as Tables<'customers'>) }
  }

  async list(params: ListParams): Promise<ListCustomersResponse> {
    const { page, limit, search, includeInactive } = params
    const offset = (page - 1) * limit

    let query = this.client
      .from('customers')
      .select('id, name, is_active, created_at, updated_at, deleted_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (!includeInactive) {
      query = query.is('deleted_at', null).eq('is_active', true)
    }

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    const { data, count, error } = await query

    if (error) {
      this.logger.error('Błąd podczas pobierania listy klientów', error)
      throw error
    }

    const items = (data ?? []).map((row) => CustomerMapper.toDto(row as Tables<'customers'>))

    return {
      items,
      total: count ?? 0,
      page,
      limit
    }
  }
}


