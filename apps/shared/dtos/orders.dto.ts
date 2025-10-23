import type { Tables } from "../../db/database.types"

import type { PaginatedResponse, UUID } from "./common.dto"
import type { CustomerDto } from "./customers.dto"
import type { UserSummaryDto } from "./user-roles.dto"

type OrderRow = Tables<"orders">

/**
 * DTO zamówienia prezentowane na liście.
 */
export interface OrderListItemDto {
  id: OrderRow["id"]
  orderNo: OrderRow["order_no"]
  customer: Pick<CustomerDto, "id" | "name">
  orderDate: OrderRow["order_date"]
  itemName: OrderRow["item_name"]
  quantity: OrderRow["quantity"]
  isEur: OrderRow["is_eur"]
  eurRate: OrderRow["eur_rate"]
  producerDiscountPct: OrderRow["producer_discount_pct"]
  distributorDiscountPct: OrderRow["distributor_discount_pct"]
  vatRatePct: OrderRow["vat_rate_pct"]
  totalNetPln: OrderRow["total_net_pln"]
  totalGrossPln: OrderRow["total_gross_pln"]
  totalGrossEur: OrderRow["total_gross_eur"]
  createdBy: UserSummaryDto
  createdAt: OrderRow["created_at"]
  updatedAt: OrderRow["updated_at"]
  deletedAt: OrderRow["deleted_at"]
}

export type ListOrdersResponse = PaginatedResponse<OrderListItemDto>

/**
 * ZAawansowane parametry filtrowania listy zamówień.
 */
export interface ListOrdersQuery {
  page?: number
  limit?: number
  customerId?: UUID
  orderNo?: string
  dateFrom?: string
  dateTo?: string
  isEur?: boolean
  sort?: string
  includeDeleted?: boolean
}

export interface OrderDetailDto extends OrderListItemDto {
  comment: OrderRow["comment"]
  currencyCode: OrderRow["currency_code"]
}

export interface OrderAuditEntryDto {
  id: number
  occurredAt: string
  operation: string
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
  changedBy: UserSummaryDto | null
}

export type OrderAuditResponse = PaginatedResponse<OrderAuditEntryDto>

export interface BaseOrderCommand {
  orderNo: OrderRow["order_no"]
  customerId: OrderRow["customer_id"]
  orderDate: OrderRow["order_date"]
  itemName: OrderRow["item_name"]
  quantity: OrderRow["quantity"]
  isEur: OrderRow["is_eur"]
  eurRate?: OrderRow["eur_rate"]
  producerDiscountPct: OrderRow["producer_discount_pct"]
  distributorDiscountPct: OrderRow["distributor_discount_pct"]
  vatRatePct: OrderRow["vat_rate_pct"]
  totalNetPln: OrderRow["total_net_pln"]
  totalGrossPln: OrderRow["total_gross_pln"]
  totalGrossEur?: OrderRow["total_gross_eur"]
  comment?: OrderRow["comment"]
}

export interface CreateOrderCommand extends BaseOrderCommand {}

export interface UpdateOrderCommand extends BaseOrderCommand {}

export interface RestoreOrderCommand {
  orderId: OrderRow["id"]
}

export interface DeleteOrderCommand {
  orderId: OrderRow["id"]
}

export interface OrderResponse extends OrderDetailDto {}

