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

const MAX_RANGE_DAYS = 366;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

@ValidatorConstraint({ name: 'AnalyticsDateRange', async: false })
class AnalyticsDateRangeConstraint implements ValidatorConstraintInterface {
  validate(_value: string, args: ValidationArguments): boolean {
    const dto = args.object as GetKpiAnalyticsQueryDto;

    if (!dto.dateFrom || !dto.dateTo) {
      return true;
    }

    const start = new Date(dto.dateFrom);
    const end = new Date(dto.dateTo);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return false;
    }

    if (start > end) {
      return false;
    }

    const diffDays =
      Math.floor((end.getTime() - start.getTime()) / DAY_IN_MS) + 1;

    return diffDays <= MAX_RANGE_DAYS;
  }

  defaultMessage(): string {
    return `Zakres dat nie może być dłuższy niż ${MAX_RANGE_DAYS} dni, a data początkowa nie może być późniejsza niż końcowa.`;
  }
}

export class GetKpiAnalyticsQueryDto implements AnalyticsRangeQuery {
  @ApiProperty({
    description: 'Początek zakresu dat (ISO 8601).',
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
    description: 'Koniec zakresu dat (ISO 8601).',
    example: '2024-03-31',
  })
  @IsString({ message: 'Parametr dateTo musi być tekstem.' })
  @IsNotEmpty({ message: 'Parametr dateTo jest wymagany.' })
  @IsISO8601(
    {},
    { message: 'Parametr dateTo musi być poprawnym formatem ISO 8601.' }
  )
  @Validate(AnalyticsDateRangeConstraint)
  dateTo!: string;

  @ApiPropertyOptional({
    description: 'Identyfikator klienta (UUID v4).',
    example: 'a24fd3f0-0f2b-4b23-93df-8f04dea7c07f',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Parametr customerId musi być poprawnym UUID v4.' })
  customerId?: string;
}


