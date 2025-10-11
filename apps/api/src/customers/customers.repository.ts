import { Injectable } from '@nestjs/common'
import type { PostgrestError } from '@supabase/supabase-js'

import type { TablesInsert } from 'apps/db/database.types'
import { supabaseClient } from 'apps/db/supabase.client'
import { CustomerMapper } from './customers.mapper'
import type { CustomerDto } from 'apps/shared/dtos/customers.dto'

interface InsertCustomerParams {
  name: string
  isActive: boolean
  actorId: string
}

@Injectable()
export class CustomersRepository {
  private readonly client = supabaseClient

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
}


