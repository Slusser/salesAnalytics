import type { CustomerMutatorContext } from '@shared/dtos/customers.dto';

import type { GetKpiAnalyticsQueryDto } from '../dto/get-kpi-analytics-query.dto';
import type { AnalyticsKpiQuery } from '../models/kpi.types';

export class AnalyticsKpiMapper {
  static toQuery(
    dto: GetKpiAnalyticsQueryDto,
    requester: CustomerMutatorContext
  ): AnalyticsKpiQuery {
    return {
      dateFrom: new Date(dto.dateFrom),
      dateTo: new Date(dto.dateTo),
      customerId: dto.customerId,
      requester,
    };
  }
}


