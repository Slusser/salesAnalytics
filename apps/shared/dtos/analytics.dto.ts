import type { UUID } from "./common.dto"
import type { CustomerMutatorContext } from "./customers.dto"

export interface AnalyticsRangeQuery {
  dateFrom?: string
  dateTo?: string
  customerId?: UUID
}

export interface AnalyticsKpiDto {
  sumNetPln: number
  sumGrossPln: number
  sumDistributorPln: number
  sumCustomerPln: number
  sumProfitPln: number
  ordersCount: number
  avgOrderValue: number
  avgMarginPct: number
}

export interface AnalyticsTrendEntryDto {
  period: string
  sumNetPln: number | null
}

export interface AnalyticsDailyEntryDto {
  date: string
  sumNetPln: number
  sumGrossPln: number
  sumDistributorPln: number
  sumCustomerPln: number
  sumProfitPln: number
  avgMarginPct: number
  ordersCount: number
}

export interface AnalyticsDailyQuery {
  year: number
  month: number
  customerId?: UUID
}

export interface AnalyticsTrendCommand extends AnalyticsRangeQuery {
  dateFrom: string
  dateTo: string
  customerId?: UUID
  requester: CustomerMutatorContext
}

export type AnalyticsKpiResponseDto = AnalyticsKpiDto
export type AnalyticsTrendEntryResponseDto = AnalyticsTrendEntryDto
export type AnalyticsTrendResponseDto = AnalyticsTrendEntryResponseDto[]
export type DailyOrdersAnalyticsItemDto = AnalyticsDailyEntryDto
export type AnalyticsDailyResponseDto = AnalyticsDailyEntryDto[]

