import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

import type { AnalyticsDailyQuery } from '@shared/dtos/analytics.dto';

const MIN_SUPPORTED_YEAR = 2000;
const CURRENT_YEAR = new Date().getUTCFullYear();

@ValidatorConstraint({ name: 'DailyAnalyticsMonthRange', async: false })
class DailyAnalyticsMonthRangeConstraint
  implements ValidatorConstraintInterface
{
  validate(_value: number, args: ValidationArguments): boolean {
    const dto = args.object as GetDailyOrdersAnalyticsQueryDto;

    if (!Number.isInteger(dto.year) || !Number.isInteger(dto.month)) {
      return false;
    }

    if (dto.month < 1 || dto.month > 12) {
      return false;
    }

    const requestedMonthIndex = dto.year * 12 + (dto.month - 1);

    const now = new Date();
    const currentMonthIndex =
      now.getUTCFullYear() * 12 + now.getUTCMonth();

    return requestedMonthIndex <= currentMonthIndex;
  }

  defaultMessage(): string {
    return 'Nie można pobrać danych dla przyszłego miesiąca.';
  }
}

export class GetDailyOrdersAnalyticsQueryDto
  implements AnalyticsDailyQuery
{
  @ApiProperty({
    description: 'Rok referencyjny (UTC).',
    example: 2024,
    minimum: MIN_SUPPORTED_YEAR,
    maximum: CURRENT_YEAR,
  })
  @Type(() => Number)
  @IsInt({ message: 'Parametr year musi być liczbą całkowitą.' })
  @Min(MIN_SUPPORTED_YEAR, {
    message: `Parametr year nie może być mniejszy niż ${MIN_SUPPORTED_YEAR}.`,
  })
  @Max(CURRENT_YEAR, {
    message: `Parametr year nie może być większy niż ${CURRENT_YEAR}.`,
  })
  year!: number;

  @ApiProperty({
    description: 'Miesiąc (1-12).',
    example: 5,
    minimum: 1,
    maximum: 12,
  })
  @Type(() => Number)
  @IsInt({ message: 'Parametr month musi być liczbą całkowitą.' })
  @Min(1, { message: 'Parametr month nie może być mniejszy niż 1.' })
  @Max(12, { message: 'Parametr month nie może być większy niż 12.' })
  @Validate(DailyAnalyticsMonthRangeConstraint)
  month!: number;

  @ApiPropertyOptional({
    description: 'Identyfikator klienta (UUID v4).',
    example: 'c4a9b6d2-6087-43b6-a2b7-2c63a9a58877',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Parametr customerId musi być poprawnym UUID v4.' })
  customerId?: string;
}


