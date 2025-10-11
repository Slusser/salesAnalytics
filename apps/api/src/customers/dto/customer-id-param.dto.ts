import { ApiProperty } from '@nestjs/swagger'
import { IsUUID } from 'class-validator'

/**
 * DTO odpowiadające za walidację parametru ścieżki `customerId`.
 */
export class CustomerIdParamDto {
  @ApiProperty({
    description: 'Identyfikator klienta.',
    format: 'uuid',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6'
  })
  @IsUUID('4', { message: 'Parametr customerId musi być poprawnym identyfikatorem UUID v4.' })
  customerId!: string
}


