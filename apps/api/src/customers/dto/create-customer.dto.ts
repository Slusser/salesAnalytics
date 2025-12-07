import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const CUSTOMER_NAME_MAX_LENGTH = 120;

const transformOptionalNumber = ({
  value,
}: {
  value: unknown;
}): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) {
      return undefined;
    }
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return value as number;
};

export class CreateCustomerDto {
  @ApiProperty({
    description:
      'Unikalna nazwa klienta. Zostanie przycięta do dozwolonych znaków.',
    minLength: 1,
    maxLength: CUSTOMER_NAME_MAX_LENGTH,
    example: 'Acme Sp. z o.o.',
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Nazwa klienta nie może być pusta.' })
  @MaxLength(CUSTOMER_NAME_MAX_LENGTH, {
    message: `Nazwa klienta nie może przekraczać ${CUSTOMER_NAME_MAX_LENGTH} znaków.`,
  })
  readonly name!: string;

  @ApiPropertyOptional({
    description: 'Określa, czy klient ma pozostać aktywny. Domyślnie true.',
    default: true,
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') {
        return true;
      }
      if (normalized === 'false') {
        return false;
      }
    }

    return value;
  })
  @IsBoolean({ message: 'Pole isActive musi być wartością logiczną.' })
  readonly isActive?: boolean;

  @ApiPropertyOptional({
    description:
      'Domyślny rabat dla dystrybutora (w %) stosowany przy nowych zamówieniach.',
    default: 0,
    example: 5,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @Transform(transformOptionalNumber)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'Pole defaultDistributorDiscountPct musi być liczbą.' },
  )
  @Min(0, {
    message: 'Domyślny rabat dystrybutora nie może być mniejszy niż 0%.',
  })
  @Max(100, {
    message: 'Domyślny rabat dystrybutora nie może przekraczać 100%.',
  })
  readonly defaultDistributorDiscountPct?: number;
}
