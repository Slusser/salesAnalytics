import { ApiProperty } from '@nestjs/swagger';

import type { AnalyticsKpiDto } from '@shared/dtos/analytics.dto';

export class AnalyticsKpiResponseDto implements AnalyticsKpiDto {
  @ApiProperty({
    description: 'Łączna wartość netto w PLN dla wskazanego zakresu.',
    example: 125000.75,
  })
  sumNetPln!: number;

  @ApiProperty({
    description: 'Liczba zamówień w zadanym zakresie dat.',
    example: 42,
  })
  ordersCount!: number;

  @ApiProperty({
    description: 'Średnia wartość zamówienia w PLN (sumNetPln / ordersCount).',
    example: 2976.2,
  })
  avgOrderValue!: number;
}


