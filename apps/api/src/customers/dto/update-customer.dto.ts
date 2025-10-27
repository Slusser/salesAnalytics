import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const CUSTOMER_NAME_MAX_LENGTH = 120;

const CUSTOMER_NAME_SAFE_PATTERN = /^[\p{L}\p{M}\p{N}\s\-_'.,&()\/]+$/u;

const transformOptionalString = ({
  value,
}: {
  value: unknown;
}): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value as string;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  return trimmed;
};

const transformOptionalBoolean = ({
  value,
}: {
  value: unknown;
}): boolean | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
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

  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }
  }

  return value as boolean | undefined;
};

const transformOptionalDate = ({
  value,
}: {
  value: unknown;
}): string | null | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();

    if (!normalized) {
      return undefined;
    }

    return normalized;
  }

  return value as string;
};

export class UpdateCustomerDto {
  @ApiPropertyOptional({
    description: 'Zaktualizowana nazwa klienta.',
    minLength: 1,
    maxLength: CUSTOMER_NAME_MAX_LENGTH,
    example: 'Acme Polska Sp. z o.o.',
  })
  @IsOptional()
  @IsString({ message: 'Pole name musi być tekstem.' })
  @Transform(transformOptionalString)
  @IsNotEmpty({ message: 'Pole name nie może być puste.' })
  @MaxLength(CUSTOMER_NAME_MAX_LENGTH, {
    message: `Pole name nie może przekraczać ${CUSTOMER_NAME_MAX_LENGTH} znaków.`,
  })
  @Matches(CUSTOMER_NAME_SAFE_PATTERN, {
    message:
      "Pole name zawiera niedozwolone znaki. Dozwolone są litery, cyfry, spacje oraz znaki - _ ' . , & ( ) /.",
  })
  readonly name?: string;

  @ApiPropertyOptional({
    description: 'Flaga określająca, czy klient ma być aktywny.',
    example: true,
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean({ message: 'Pole isActive musi być wartością logiczną.' })
  readonly isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Data soft-delete klienta w formacie ISO 8601.',
    example: '2025-10-11T12:34:56.000Z',
    nullable: true,
  })
  @IsOptional()
  @Transform(transformOptionalDate)
  @IsDateString(
    {},
    { message: 'Pole deletedAt musi być poprawną datą w formacie ISO 8601.' }
  )
  readonly deletedAt?: string | null;
}
