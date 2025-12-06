import { ApiPropertyOptional } from '@nestjs/swagger';

import type { OrderDetailDto } from '@shared/dtos/orders.dto';
import { OrderListItemResponseDto } from './list-orders-response.dto';

export class OrderDetailResponseDto
  extends OrderListItemResponseDto
  implements OrderDetailDto
{
  @ApiPropertyOptional({ description: 'Dodatkowy komentarz do zamówienia.' })
  comment!: string | null;
}
