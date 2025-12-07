import { ApiProperty } from '@nestjs/swagger';

import type { AnalyticsKpiDto } from '@shared/dtos/analytics.dto';

export class AnalyticsKpiResponseDto implements AnalyticsKpiDto {
  @ApiProperty({
    description: 'Łączna wartość netto w PLN dla wskazanego zakresu.',
    example: 125000.75,
  })
  sumNetPln!: number;

  @ApiProperty({
    description: 'Łączna wartość brutto w PLN dla wskazanego zakresu.',
    example: 153750.92,
  })
  sumGrossPln!: number;

  @ApiProperty({
    description: 'Liczba zamówień w zadanym zakresie dat.',
    example: 42,
  })
  ordersCount!: number;

  @ApiProperty({
    description:
      'Łączna cena dystrybutora (po rabacie dystrybutora) w PLN dla zakresu.',
    example: 112000.5,
  })
  sumDistributorPln!: number;

  @ApiProperty({
    description:
      'Łączna cena kontrahenta (po rabacie kontrahenta) w PLN dla zakresu.',
    example: 98000.3,
  })
  sumCustomerPln!: number;

  @ApiProperty({
    description: 'Łączna marża (PLN) w analizowanym zakresie.',
    example: 14002.2,
  })
  sumProfitPln!: number;

  @ApiProperty({
    description: 'Średnia wartość zamówienia w PLN (sumNetPln / ordersCount).',
    example: 2976.2,
  })
  avgOrderValue!: number;

  @ApiProperty({
    description: 'Średnia marża procentowa w analizowanym zakresie.',
    example: 12.5,
  })
  avgMarginPct!: number;
}


