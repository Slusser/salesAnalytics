import type { CustomerMutatorContext } from '@shared/dtos/customers.dto';

export interface AnalyticsKpiQuery {
  dateFrom: Date;
  dateTo: Date;
  customerId?: string;
  requester: CustomerMutatorContext;
}

export interface AnalyticsKpiAggregate {
  sumNetPln: number;
  ordersCount: number;
}

export interface AnalyticsKpiResult {
  sumNetPln: number;
  ordersCount: number;
  avgOrderValue: number;
}


