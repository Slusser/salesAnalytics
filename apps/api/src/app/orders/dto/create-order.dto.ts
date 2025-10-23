import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf
} from 'class-validator'

import type { CreateOrderCommand } from 'apps/shared/dtos/orders.dto'

const ORDER_NO_MAX_LENGTH = 64
const ITEM_NAME_MAX_LENGTH = 255
const COMMENT_MAX_LENGTH = 2000
const MAX_DISCOUNT = 100
const MAX_VAT = 50

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return undefined
  }

  return trimmed
}

const normalizeOrderNo = (value: unknown): string | undefined => {
  const normalized = normalizeString(value)

  if (!normalized) {
    return undefined
  }

  return normalized.toUpperCase()
}

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)

    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}

export class CreateOrderDto implements CreateOrderCommand {
  @ApiProperty({ description: 'Numer zamówienia', maxLength: ORDER_NO_MAX_LENGTH })
  @Transform(({ value }) => normalizeOrderNo(value))
  @IsString({ message: 'Pole orderNo musi być tekstem.' })
  @MaxLength(ORDER_NO_MAX_LENGTH, {
    message: `Numer zamówienia nie może przekraczać ${ORDER_NO_MAX_LENGTH} znaków.`
  })
  @IsNotEmpty({ message: 'Numer zamówienia jest wymagany.' })
  orderNo!: string

  @ApiProperty({ description: 'Identyfikator klienta składającego zamówienie', format: 'uuid' })
  @IsUUID('4', { message: 'Pole customerId musi być poprawnym identyfikatorem UUID v4.' })
  customerId!: string

  @ApiProperty({ description: 'Data zamówienia', format: 'date' })
  @IsDateString({}, { message: 'Pole orderDate musi być poprawną datą w formacie ISO 8601.' })
  orderDate!: string

  @ApiProperty({ description: 'Nazwa pozycji zamówienia', maxLength: ITEM_NAME_MAX_LENGTH })
  @Transform(({ value }) => normalizeString(value))
  @IsString({ message: 'Pole itemName musi być tekstem.' })
  @MaxLength(ITEM_NAME_MAX_LENGTH, {
    message: `Nazwa pozycji nie może przekraczać ${ITEM_NAME_MAX_LENGTH} znaków.`
  })
  @IsNotEmpty({ message: 'Nazwa pozycji jest wymagana.' })
  itemName!: string

  @ApiProperty({ description: 'Ilość zamówionych sztuk', minimum: 1, type: Number })
  @Transform(({ value }) => toNumber(value))
  @IsNumber({ allowInfinity: false, allowNaN: false }, { message: 'Pole quantity musi być liczbą.' })
  @IsPositive({ message: 'Ilość musi być dodatnia.' })
  quantity!: number

  @ApiProperty({ description: 'Czy zamówienie rozliczane jest w EUR', default: false })
  @Transform(({ value }) => {
    if (typeof value === 'boolean') {
      return value
    }

    if (value === 'true' || value === '1') {
      return true
    }

    if (value === 'false' || value === '0') {
      return false
    }

    return value
  })
  @IsBoolean({ message: 'Pole isEur musi być wartością logiczną.' })
  isEur!: boolean

  @ApiPropertyOptional({ description: 'Kurs EUR zastosowany w zamówieniu', minimum: 0, type: Number })
  @Transform(({ value }) => toNumber(value))
  @ValidateIf((dto: CreateOrderDto) => dto.isEur)
  @IsNumber({ allowInfinity: false, allowNaN: false }, { message: 'Pole eurRate musi być liczbą.' })
  @IsPositive({ message: 'Kurs EUR musi być dodatni.' })
  eurRate?: number

  @ApiProperty({ description: 'Rabat producenta w procentach', minimum: 0, maximum: MAX_DISCOUNT, type: Number })
  @Transform(({ value }) => toNumber(value))
  @IsNumber({ allowInfinity: false, allowNaN: false }, { message: 'Pole producerDiscountPct musi być liczbą.' })
  @Min(0, { message: 'Rabat producenta nie może być mniejszy niż 0.' })
  @Max(MAX_DISCOUNT, {
    message: `Rabat producenta nie może być większy niż ${MAX_DISCOUNT}.`
  })
  producerDiscountPct!: number

  @ApiProperty({ description: 'Rabat dystrybutora w procentach', minimum: 0, maximum: MAX_DISCOUNT, type: Number })
  @Transform(({ value }) => toNumber(value))
  @IsNumber({ allowInfinity: false, allowNaN: false }, { message: 'Pole distributorDiscountPct musi być liczbą.' })
  @Min(0, { message: 'Rabat dystrybutora nie może być mniejszy niż 0.' })
  @Max(MAX_DISCOUNT, {
    message: `Rabat dystrybutora nie może być większy niż ${MAX_DISCOUNT}.`
  })
  distributorDiscountPct!: number

  @ApiProperty({ description: 'Stawka VAT w procentach', minimum: 0, maximum: MAX_VAT, type: Number })
  @Transform(({ value }) => toNumber(value))
  @IsNumber({ allowInfinity: false, allowNaN: false }, { message: 'Pole vatRatePct musi być liczbą.' })
  @Min(0, { message: 'Stawka VAT nie może być mniejsza niż 0.' })
  @Max(MAX_VAT, {
    message: `Stawka VAT nie może być większa niż ${MAX_VAT}.`
  })
  vatRatePct!: number

  @ApiProperty({ description: 'Suma netto w PLN', minimum: 0, type: Number })
  @Transform(({ value }) => toNumber(value))
  @IsNumber({ allowInfinity: false, allowNaN: false }, { message: 'Pole totalNetPln musi być liczbą.' })
  @Min(0, { message: 'Suma netto nie może być ujemna.' })
  totalNetPln!: number

  @ApiProperty({ description: 'Suma brutto w PLN', minimum: 0, type: Number })
  @Transform(({ value }) => toNumber(value))
  @IsNumber({ allowInfinity: false, allowNaN: false }, { message: 'Pole totalGrossPln musi być liczbą.' })
  @Min(0, { message: 'Suma brutto nie może być ujemna.' })
  totalGrossPln!: number

  @ApiPropertyOptional({ description: 'Suma brutto w EUR (jeśli dotyczy)', minimum: 0, type: Number })
  @Transform(({ value }) => toNumber(value))
  @ValidateIf((dto: CreateOrderDto) => dto.isEur)
  @IsNumber({ allowInfinity: false, allowNaN: false }, { message: 'Pole totalGrossEur musi być liczbą.' })
  @Min(0, { message: 'Suma brutto w EUR nie może być ujemna.' })
  totalGrossEur?: number

  @ApiPropertyOptional({ description: 'Dodatkowy komentarz do zamówienia', maxLength: COMMENT_MAX_LENGTH })
  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return undefined
    }

    if (typeof value !== 'string') {
      return value
    }

    const trimmed = value.trim()

    if (!trimmed) {
      return undefined
    }

    return trimmed
  })
  @IsOptional()
  @IsString({ message: 'Pole comment musi być tekstem.' })
  @MaxLength(COMMENT_MAX_LENGTH, {
    message: `Komentarz nie może przekraczać ${COMMENT_MAX_LENGTH} znaków.`
  })
  comment?: string
}
