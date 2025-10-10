import type { UUID } from "./common.dto"

export interface AnalyticsRangeQuery {
  dateFrom?: string
  dateTo?: string
  customerId?: UUID
}

export interface AnalyticsKpiDto {
  sumNetPln: number
  ordersCount: number
  avgOrderValue: number
}

export interface AnalyticsTrendEntryDto {
  period: string
  sumNetPln: number
}

export interface AnalyticsDailyEntryDto {
  date: string
  sumNetPln: number
  ordersCount: number
}

export interface AnalyticsDailyQuery {
  year: number
  month: number
  customerId?: UUID
}

