import { ApiProperty } from '@nestjs/swagger';

export class DailyOrdersAnalyticsItemDto {
  @ApiProperty({
    description: 'Data zamówień w formacie YYYY-MM-DD (UTC).',
    example: '2024-05-12',
  })
  date!: string;

  @ApiProperty({
    description: 'Suma wartości netto zamówień (PLN) dla dnia.',
    example: 125000.45,
  })
  sumNetPln!: number;

  @ApiProperty({
    description: 'Liczba zamówień w danym dniu.',
    example: 7,
  })
  ordersCount!: number;
}


