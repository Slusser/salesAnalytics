import { Transform } from 'class-transformer'
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

const CUSTOMER_NAME_MAX_LENGTH = 120

export class CreateCustomerDto {
  @ApiProperty({
    description: 'Unikalna nazwa klienta. Zostanie przycięta do dozwolonych znaków.',
    minLength: 1,
    maxLength: CUSTOMER_NAME_MAX_LENGTH,
    example: 'Acme Sp. z o.o.'
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Nazwa klienta nie może być pusta.' })
  @MaxLength(CUSTOMER_NAME_MAX_LENGTH, {
    message: `Nazwa klienta nie może przekraczać ${CUSTOMER_NAME_MAX_LENGTH} znaków.`
  })
  readonly name!: string

  @ApiPropertyOptional({
    description: 'Określa, czy klient ma pozostać aktywny. Domyślnie true.',
    default: true,
    example: true
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined
    }

    if (typeof value === 'boolean') {
      return value
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (normalized === 'true') {
        return true
      }
      if (normalized === 'false') {
        return false
      }
    }

    return value
  })
  @IsBoolean({ message: 'Pole isActive musi być wartością logiczną.' })
  readonly isActive?: boolean
}


