import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { UpdateOrderCommand } from '@shared/dtos/orders.dto';
import { CreateOrderDto } from './create-order.dto';

/**
 * DTO walidujący pełną aktualizację zamówienia.
 * Wykorzystuje identyczne ograniczenia jak przy tworzeniu zamówienia.
 */
export class UpdateOrderDto
  extends CreateOrderDto
  implements UpdateOrderCommand
{
  @ApiProperty({ description: 'Numer zamówienia.' })
  declare orderNo: string;

  @ApiProperty({
    description: 'Identyfikator klienta powiązanego z zamówieniem.',
    format: 'uuid',
  })
  declare customerId: string;

  @ApiProperty({ description: 'Data zamówienia.', format: 'date' })
  declare orderDate: string;

  @ApiProperty({ description: 'Nazwa pozycji zamówienia.' })
  declare itemName: string;

  @ApiProperty({
    description: 'Ilość zamówionych sztuk.',
    type: Number,
    minimum: 1,
  })
  declare quantity: number;

  @ApiProperty({ description: 'Czy zamówienie rozliczane jest w EUR.' })
  declare isEur: boolean;

  @ApiPropertyOptional({
    description: 'Kurs EUR zastosowany w zamówieniu.',
    type: Number,
  })
  declare eurRate?: number;

  @ApiProperty({ description: 'Rabat producenta w procentach.', type: Number })
  declare producerDiscountPct: number;

  @ApiProperty({
    description: 'Rabat dystrybutora w procentach.',
    type: Number,
  })
  declare distributorDiscountPct: number;

  @ApiProperty({ description: 'Stawka VAT w procentach.', type: Number })
  declare vatRatePct: number;

  @ApiProperty({ description: 'Suma netto w PLN.', type: Number })
  declare totalNetPln: number;

  @ApiProperty({ description: 'Suma brutto w PLN.', type: Number })
  declare totalGrossPln: number;

  @ApiPropertyOptional({
    description: 'Suma brutto w EUR (jeśli dotyczy).',
    type: Number,
  })
  declare totalGrossEur?: number;

  @ApiPropertyOptional({ description: 'Dodatkowy komentarz do zamówienia.' })
  declare comment?: string;
}
