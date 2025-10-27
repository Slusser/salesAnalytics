import { ApiProperty } from '@nestjs/swagger';

import type {
  CustomerDto,
  ListCustomersResponse,
} from 'apps/shared/dtos/customers.dto';

export class CustomerResponseDto implements CustomerDto {
  @ApiProperty({ description: 'Identyfikator klienta.', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Nazwa klienta.' })
  name!: string;

  @ApiProperty({ description: 'Czy klient jest aktywny.' })
  isActive!: boolean;

  @ApiProperty({ description: 'Data utworzenia rekordu.', format: 'date-time' })
  createdAt!: string;

  @ApiProperty({
    description: 'Data ostatniej aktualizacji rekordu.',
    format: 'date-time',
  })
  updatedAt!: string;

  @ApiProperty({
    description: 'Data soft-delete rekordu.',
    format: 'date-time',
    nullable: true,
  })
  deletedAt!: string | null;
}

export class ListCustomersResponseDto implements ListCustomersResponse {
  @ApiProperty({ type: CustomerResponseDto, isArray: true })
  items!: CustomerResponseDto[];

  @ApiProperty({
    description: 'Łączna liczba klientów spełniających kryteria.',
  })
  total!: number;

  @ApiProperty({ description: 'Aktualny numer strony.' })
  page!: number;

  @ApiProperty({ description: 'Limit rekordów na stronie.' })
  limit!: number;
}
