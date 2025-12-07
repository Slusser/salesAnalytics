import type { Tables } from "../../db/database.types"

import type { PaginatedResponse } from "./common.dto"
import type { UserRoleValue } from "./user-roles.dto"

type CustomerRow = Tables<"customers">

/**
 * DTO reprezentujące pojedynczego klienta w odpowiedziach API.
 */
export interface CustomerDto {
  id: CustomerRow["id"]
  name: CustomerRow["name"]
  isActive: CustomerRow["is_active"]
  defaultDistributorDiscountPct: CustomerRow["default_distributor_discount_pct"]
  createdAt: CustomerRow["created_at"]
  updatedAt: CustomerRow["updated_at"]
  deletedAt: CustomerRow["deleted_at"]
}

/**
 * Parametry zapytania listy klientów.
 */
export interface ListCustomersQuery {
  page?: number
  limit?: number
  search?: string
  includeInactive?: boolean
}

export type ListCustomersResponse = PaginatedResponse<CustomerDto>

export interface CreateCustomerCommand {
  name: CustomerRow["name"]
  isActive: CustomerRow["is_active"]
  defaultDistributorDiscountPct?: CustomerRow["default_distributor_discount_pct"]
}

export interface UpdateCustomerCommand {
  name?: CustomerRow["name"]
  isActive?: CustomerRow["is_active"]
  defaultDistributorDiscountPct?: CustomerRow["default_distributor_discount_pct"]
  deletedAt?: CustomerRow["deleted_at"]
}

export interface RestoreCustomerCommand {
  customerId: CustomerRow["id"]
}

export interface RestoreCustomerResponse extends CustomerDto {}

export interface CustomerDetailResponse extends CustomerDto {}

export interface DeleteCustomerCommand {
  customerId: CustomerRow["id"]
  actorId: string
  actorRoles: UserRoleValue[]
  accessToken: string
}

export interface DeleteCustomerResponse extends CustomerDto {}

/**
 * Response admina aktualizującego użytkownika; przypięte tu dla współdzielenia typów.
 */
export interface CustomerMutatorContext {
  actorId: string
  actorRoles: UserRoleValue[]
  accessToken: string
  customerIds?: string[]
}

