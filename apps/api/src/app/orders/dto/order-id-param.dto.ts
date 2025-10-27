import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * DTO walidujący parametr ścieżki `orderId` dla zasobów zamówień.
 */
export class OrderIdParamDto {
  @ApiProperty({
    description: 'Identyfikator zamówienia.',
    format: 'uuid',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @IsUUID('4', {
    message: 'Parametr orderId musi być poprawnym identyfikatorem UUID v4.',
  })
  orderId!: string;
}
