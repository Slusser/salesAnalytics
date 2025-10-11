import type { Tables } from 'apps/db/database.types'
import type { CustomerDto } from 'apps/shared/dtos/customers.dto'

type CustomerRow = Tables<'customers'>

export class CustomerMapper {
  static toDto(row: CustomerRow): CustomerDto {
    return {
      id: row.id,
      name: row.name,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at
    }
  }
}


