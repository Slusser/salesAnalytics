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
    description: 'Suma wartości brutto zamówień (PLN) dla dnia.',
    example: 153750.6,
  })
  sumGrossPln!: number;

  @ApiProperty({
    description: 'Suma cen dystrybutora (PLN) dla dnia.',
    example: 112000.75,
  })
  sumDistributorPln!: number;

  @ApiProperty({
    description: 'Suma cen kontrahenta (PLN) dla dnia.',
    example: 98050.25,
  })
  sumCustomerPln!: number;

  @ApiProperty({
    description: 'Suma marży (PLN) wygenerowanej w danym dniu.',
    example: 13950.5,
  })
  sumProfitPln!: number;

  @ApiProperty({
    description: 'Średnia marża procentowa w danym dniu.',
    example: 12.5,
  })
  avgMarginPct!: number;

  @ApiProperty({
    description: 'Liczba zamówień w danym dniu.',
    example: 7,
  })
  ordersCount!: number;
}


