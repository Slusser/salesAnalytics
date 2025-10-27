import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import type { ListCustomersQuery } from 'apps/shared/dtos/customers.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_SEARCH_LENGTH = 120;

type TransformFnParams = { value: unknown };

const toInt = (
  { value }: TransformFnParams,
  defaultValue: number
): number | unknown => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) {
      return defaultValue;
    }

    const parsed = Number(normalized);

    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return value;
};

const toBoolean = (
  { value }: TransformFnParams,
  defaultValue: boolean
): boolean | unknown => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'true' || normalized === '1') {
      return true;
    }

    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }

  return value;
};

const normalizeSearch = ({
  value,
}: TransformFnParams): string | undefined | unknown => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return undefined;
  }

  return normalized;
};

export class ListCustomersQueryDto implements ListCustomersQuery {
  @ApiPropertyOptional({
    description: 'Numer strony wyników paginacji (1-indexed).',
    minimum: 1,
    default: DEFAULT_PAGE,
    example: 2,
  })
  @IsOptional()
  @Transform((params) => toInt(params, DEFAULT_PAGE))
  @IsInt({ message: 'Parametr page musi być liczbą całkowitą.' })
  @Min(1, { message: 'Parametr page musi być większy lub równy 1.' })
  page?: number;

  @ApiPropertyOptional({
    description: 'Maksymalna liczba rekordów zwracanych na stronie.',
    minimum: 1,
    maximum: MAX_LIMIT,
    default: DEFAULT_LIMIT,
    example: 50,
  })
  @IsOptional()
  @Transform((params) => toInt(params, DEFAULT_LIMIT))
  @IsInt({ message: 'Parametr limit musi być liczbą całkowitą.' })
  @Min(1, { message: 'Parametr limit musi być większy lub równy 1.' })
  @Max(MAX_LIMIT, {
    message: `Parametr limit nie może przekraczać ${MAX_LIMIT}.`,
  })
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Fraza wyszukiwania dopasowywana do nazwy klienta (case-insensitive).',
    maxLength: MAX_SEARCH_LENGTH,
    example: 'acme',
  })
  @IsOptional()
  @Transform(normalizeSearch)
  @IsString({ message: 'Parametr search musi być tekstem.' })
  @MaxLength(MAX_SEARCH_LENGTH, {
    message: `Parametr search nie może przekraczać ${MAX_SEARCH_LENGTH} znaków.`,
  })
  search?: string;

  @ApiPropertyOptional({
    description:
      'Czy do wyniku należy dołączyć nieaktywnych klientów (wymaga roli editor/owner).',
    default: false,
    example: false,
  })
  @IsOptional()
  @Transform((params) => toBoolean(params, false))
  @IsBoolean({
    message: 'Parametr includeInactive musi być wartością logiczną.',
  })
  includeInactive?: boolean;
}
