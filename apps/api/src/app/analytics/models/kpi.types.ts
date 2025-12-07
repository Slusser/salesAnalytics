import type { CustomerMutatorContext } from '@shared/dtos/customers.dto';

export interface AnalyticsKpiQuery {
  dateFrom: Date;
  dateTo: Date;
  customerId?: string;
  requester: CustomerMutatorContext;
}

export interface AnalyticsKpiAggregate {
  sumNetPln: number;
  sumGrossPln: number;
  sumDistributorPln: number;
  sumCustomerPln: number;
  sumProfitPln: number;
  ordersCount: number;
}

export interface AnalyticsKpiResult {
  sumNetPln: number;
  sumGrossPln: number;
  sumDistributorPln: number;
  sumCustomerPln: number;
  sumProfitPln: number;
  ordersCount: number;
  avgOrderValue: number;
  avgMarginPct: number;
}


