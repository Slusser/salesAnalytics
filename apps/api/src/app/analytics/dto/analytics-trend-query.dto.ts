import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

import type { AnalyticsRangeQuery } from '@shared/dtos/analytics.dto';

const MAX_RANGE_MONTHS = 24;

@ValidatorConstraint({ name: 'AnalyticsTrendDateRange', async: false })
class AnalyticsTrendDateRangeConstraint
  implements ValidatorConstraintInterface
{
  validate(_value: string, args: ValidationArguments): boolean {
    const dto = args.object as AnalyticsTrendQueryDto;

    if (!dto.dateFrom || !dto.dateTo) {
      return true;
    }

    const start = this.normalize(dto.dateFrom);
    const end = this.normalize(dto.dateTo);
    const today = this.normalize(new Date().toISOString());

    if (!start || !end || !today) {
      return false;
    }

    if (start > end) {
      return false;
    }

    if (end > today || start > today) {
      return false;
    }

    const diffMonths =
      end.getUTCFullYear() * 12 +
      end.getUTCMonth() -
      (start.getUTCFullYear() * 12 + start.getUTCMonth());

    return diffMonths <= MAX_RANGE_MONTHS - 1;
  }

  defaultMessage(): string {
    return `Zakres dat musi być poprawny, obejmować maksymalnie ${MAX_RANGE_MONTHS} kolejnych miesięcy i nie może wykraczać w przyszłość.`;
  }

  private normalize(value: string): Date | null {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    date.setUTCHours(0, 0, 0, 0);
    return date;
  }
}

export class AnalyticsTrendQueryDto implements AnalyticsRangeQuery {
  @ApiProperty({
    description: 'Data początkowa zakresu (format ISO 8601, np. 2024-01-01).',
    example: '2024-01-01',
  })
  @IsString({ message: 'Parametr dateFrom musi być tekstem.' })
  @IsNotEmpty({ message: 'Parametr dateFrom jest wymagany.' })
  @IsISO8601(
    {},
    { message: 'Parametr dateFrom musi być poprawnym formatem ISO 8601.' }
  )
  dateFrom!: string;

  @ApiProperty({
    description: 'Data końcowa zakresu (format ISO 8601, np. 2024-12-31).',
    example: '2024-12-31',
  })
  @IsString({ message: 'Parametr dateTo musi być tekstem.' })
  @IsNotEmpty({ message: 'Parametr dateTo jest wymagany.' })
  @IsISO8601(
    {},
    { message: 'Parametr dateTo musi być poprawnym formatem ISO 8601.' }
  )
  @Validate(AnalyticsTrendDateRangeConstraint)
  dateTo!: string;

  @ApiPropertyOptional({
    description: 'Opcjonalny identyfikator klienta (UUID v4).',
    example: 'f21d9139-74f1-4a79-b28a-2c31f2c6dd6b',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Parametr customerId musi być poprawnym UUID v4.' })
  customerId?: string;
}


