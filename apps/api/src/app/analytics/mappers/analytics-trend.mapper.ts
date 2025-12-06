import type { AnalyticsTrendCommand } from '@shared/dtos/analytics.dto';
import type { CustomerMutatorContext } from '@shared/dtos/customers.dto';

import type { AnalyticsTrendQueryDto } from '../dto/analytics-trend-query.dto';

export class AnalyticsTrendMapper {
  static toCommand(
    dto: AnalyticsTrendQueryDto,
    requester: CustomerMutatorContext
  ): AnalyticsTrendCommand {
    return {
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
      customerId: dto.customerId,
      requester,
    };
  }
}


