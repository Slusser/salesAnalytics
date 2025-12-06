import type { AnalyticsTrendEntryDto } from '@shared/dtos/analytics.dto';
import type { CustomerMutatorContext } from '@shared/dtos/customers.dto';

export interface AnalyticsTrendQuery {
  dateFrom: Date;
  dateTo: Date;
  customerId?: string;
  requester: CustomerMutatorContext;
}

export type AnalyticsTrendResult = AnalyticsTrendEntryDto[];


