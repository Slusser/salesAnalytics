import type { CustomerMutatorContext } from '@shared/dtos/customers.dto';

export interface DailyOrdersAnalyticsCommand {
  year: number;
  month: number;
  customerId?: string;
  customerScope?: string[];
  requester: CustomerMutatorContext;
}

export interface DailyOrdersAnalyticsQuery {
  monthStart: Date;
  monthEnd: Date;
  customerId?: string;
  customerScope?: string[];
  requester: CustomerMutatorContext;
}

export interface DailyOrdersAnalyticsItem {
  date: string;
  sumNetPln: number;
  ordersCount: number;
}


