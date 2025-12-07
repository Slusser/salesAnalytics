import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type {
  ListOrdersResponse,
  OrderListItemDto,
} from '@shared/dtos/orders.dto';

export class OrderListItemResponseDto implements OrderListItemDto {
  @ApiProperty({ description: 'Identyfikator zamówienia', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Numer zamówienia' })
  orderNo!: string;

  @ApiProperty({
    description: 'Identyfikator klienta powiązanego z zamówieniem',
    format: 'uuid',
  })
  customerId!: string;

  @ApiProperty({ description: 'Data zamówienia', format: 'date' })
  orderDate!: string;

  @ApiProperty({ description: 'Nazwa produktu lub pozycji' })
  itemName!: string;

  @ApiProperty({ description: 'Ilość zamówionych sztuk', type: Number })
  quantity!: number;

  @ApiProperty({
    description: 'Cena katalogowa brutto za jednostkę (PLN)',
    type: Number,
  })
  catalogUnitGrossPln!: number;

  @ApiProperty({ description: 'Rabat producenta w procentach', type: Number })
  producerDiscountPct!: number;

  @ApiProperty({ description: 'Rabat dystrybutora w procentach', type: Number })
  distributorDiscountPct!: number;

  @ApiProperty({ description: 'Stawka VAT w procentach', type: Number })
  vatRatePct!: number;

  @ApiProperty({ description: 'Suma netto w PLN', type: Number })
  totalNetPln!: number;

  @ApiProperty({ description: 'Suma brutto w PLN', type: Number })
  totalGrossPln!: number;

  @ApiProperty({
    description: 'Cena dystrybutora w PLN po rabacie dystrybutora',
    type: Number,
  })
  distributorPricePln!: number;

  @ApiProperty({
    description: 'Cena kontrahenta w PLN po rabacie kontrahenta',
    type: Number,
  })
  customerPricePln!: number;

  @ApiProperty({ description: 'Marża (profit) w PLN', type: Number })
  profitPln!: number;

  @ApiProperty({
    description: 'Identyfikator użytkownika tworzącego zamówienie',
    format: 'uuid',
  })
  createdBy!: string;

  @ApiProperty({ description: 'Data utworzenia rekordu', format: 'date-time' })
  createdAt!: string;

  @ApiProperty({
    description: 'Data ostatniej aktualizacji rekordu',
    format: 'date-time',
  })
  updatedAt!: string;

  @ApiPropertyOptional({
    description: 'Data soft-delete rekordu',
    format: 'date-time',
  })
  deletedAt!: string | null;
}

export class ListOrdersResponseDto implements ListOrdersResponse {
  @ApiProperty({ type: OrderListItemResponseDto, isArray: true })
  items!: OrderListItemResponseDto[];

  @ApiProperty({ description: 'Łączna liczba zamówień spełniających kryteria' })
  total!: number;

  @ApiProperty({ description: 'Aktualny numer strony (1-indexed).' })
  page!: number;

  @ApiProperty({ description: 'Limit rekordów na stronie.' })
  limit!: number;
}
