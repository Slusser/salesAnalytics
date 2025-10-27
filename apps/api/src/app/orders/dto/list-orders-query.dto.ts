import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  type ValidationArguments,
} from 'class-validator';

import type { ListOrdersQuery } from '@shared/dtos/orders.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_ORDER_NO_LENGTH = 64;

const SORTABLE_FIELDS: Record<string, string> = {
  orderdate: 'orderDate',
  orderno: 'orderNo',
  customername: 'customerName',
  totalnetpln: 'totalNetPln',
  createdat: 'createdAt',
};

const SORT_DIRECTIONS = new Set(['asc', 'desc']);

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

const toBoolean = ({ value }: TransformFnParams): boolean | unknown => {
  if (value === undefined || value === null || value === '') {
    return undefined;
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

const normalizeOrderNo = ({
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

const normalizeSort = ({
  value,
}: TransformFnParams): string | undefined | unknown => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim();

  if (!normalized) {
    return undefined;
  }

  const [rawField, rawDirection] = normalized.split(':', 2);

  if (!rawField) {
    return undefined;
  }

  const candidateField = rawField.replace(/\s+/g, '').toLowerCase();
  const canonicalField = SORTABLE_FIELDS[candidateField];

  if (!canonicalField) {
    return `${rawField}:${rawDirection ?? ''}`.trim();
  }

  const direction = (rawDirection ?? 'asc').trim().toLowerCase();

  if (!direction) {
    return `${canonicalField}:asc`;
  }

  if (!SORT_DIRECTIONS.has(direction)) {
    return `${canonicalField}:${rawDirection}`;
  }

  return `${canonicalField}:${direction}`;
};

@ValidatorConstraint({ name: 'OrderSort', async: false })
class OrderSortConstraint implements ValidatorConstraintInterface {
  validate(value: string | undefined): boolean {
    if (value === undefined) {
      return true;
    }

    if (typeof value !== 'string') {
      return false;
    }

    const [field, direction] = value.split(':', 2);

    if (!field || !direction) {
      return false;
    }

    if (!Object.values(SORTABLE_FIELDS).includes(field)) {
      return false;
    }

    return SORT_DIRECTIONS.has(direction);
  }

  defaultMessage(args: ValidationArguments): string {
    const allowedFields = Object.values(SORTABLE_FIELDS).join(', ');
    return `Parametr ${args.property} musi mieć format "pole:direction", gdzie "pole" ∈ (${allowedFields}) a "direction" ∈ (asc, desc).`;
  }
}

@ValidatorConstraint({ name: 'OrderDateRange', async: false })
class OrderDateRangeConstraint implements ValidatorConstraintInterface {
  validate(dateFrom: string | undefined, args: ValidationArguments): boolean {
    if (dateFrom === undefined) {
      return true;
    }

    const object = args.object as ListOrdersQueryDto;

    if (!object.dateTo) {
      return true;
    }

    return new Date(dateFrom) <= new Date(object.dateTo);
  }

  defaultMessage(): string {
    return 'Parametr dateFrom nie może być późniejszy niż dateTo.';
  }
}

export class ListOrdersQueryDto implements ListOrdersQuery {
  @ApiPropertyOptional({
    description: 'Numer strony wyników paginacji (1-indexed).',
    default: DEFAULT_PAGE,
    minimum: 1,
    example: 2,
  })
  @IsOptional()
  @Transform((params) => toInt(params, DEFAULT_PAGE))
  @IsInt({ message: 'Parametr page musi być liczbą całkowitą.' })
  @Min(1, { message: 'Parametr page musi być większy lub równy 1.' })
  page?: number;

  @ApiPropertyOptional({
    description: 'Maksymalna liczba rekordów na stronie (1-100).',
    default: DEFAULT_LIMIT,
    minimum: 1,
    maximum: MAX_LIMIT,
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
      'Identyfikator klienta (UUID), dla którego filtrujemy zamówienia.',
    example: '7a1afcd1-6cc5-4aef-bae2-f2e4d15d807b',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Parametr customerId musi być poprawnym UUID v4.' })
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Data początkowa zakresu (format ISO 8601).',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Parametr dateFrom musi być poprawną datą w formacie ISO 8601.' }
  )
  @Validate(OrderDateRangeConstraint)
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Data końcowa zakresu (format ISO 8601).',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Parametr dateTo musi być poprawną datą w formacie ISO 8601.' }
  )
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Parametr sortowania w formacie pole:direction.',
    example: 'orderDate:desc',
  })
  @IsOptional()
  @Transform(normalizeSort)
  @IsString({ message: 'Parametr sort musi być tekstem.' })
  @Validate(OrderSortConstraint)
  sort?: string;

  @ApiPropertyOptional({
    description:
      'Czy dołączyć rekordy miękko usunięte (wymaga roli editor/owner).',
    example: false,
    default: false,
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({
    message: 'Parametr includeDeleted musi być wartością logiczną.',
  })
  includeDeleted?: boolean;
}
