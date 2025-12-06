import { ApiProperty } from '@nestjs/swagger';

export class AnalyticsTrendEntryResponseDto {
  @ApiProperty({
    description: 'Okres rozliczeniowy w formacie YYYY-MM.',
    example: '2024-01',
  })
  period!: string;

  @ApiProperty({
    description: 'Suma wartości netto zamówień w PLN dla okresu.',
    example: 15234.56,
    nullable: true,
  })
  sumNetPln!: number | null;
}


