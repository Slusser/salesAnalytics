import { Logger } from '@nestjs/common'

import type { OrderDetailDto, OrderListItemDto } from 'apps/shared/dtos/orders.dto'

export interface OrderListRow {
  id: string
  order_no: string
  order_date: string
  item_name: string
  quantity: number
  is_eur: boolean
  eur_rate: number | null
  producer_discount_pct: number
  distributor_discount_pct: number
  vat_rate_pct: number
  total_net_pln: number
  total_gross_pln: number
  total_gross_eur: number | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  customer_id: string
  created_by: string
}

export interface OrderDetailRow extends OrderListRow {
  comment: string | null
  currency_code: string
}

const logger = new Logger('OrderMapper')

/**
 * Mapper odpowiedzialny za konwersję rekordów Supabase na DTO wykorzystywane przez API.
 * Klasa pozostaje lokalna dla modułu zamówień; brak konieczności re-eksportu poza warstwę backendową.
 */
export class OrderMapper {
  static toListDto(row: OrderListRow): OrderListItemDto {
    const createdBy = row.created_by

    if (!createdBy) {
      logger.warn(`Rekord zamówienia ${row.id} nie zawiera danych o użytkowniku tworzącym.`)
    }

    return {
      id: row.id,
      orderNo: row.order_no,
      customerId: row.customer_id,
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
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at
    }
  }

  static toDetailDto(row: OrderDetailRow): OrderDetailDto {
    const base = this.toListDto(row)

    return {
      ...base,
      comment: row.comment,
      currencyCode: row.currency_code
    }
  }
}


