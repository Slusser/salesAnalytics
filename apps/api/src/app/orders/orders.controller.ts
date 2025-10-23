import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiExtraModels
} from '@nestjs/swagger'

import type { ListOrdersResponse, OrderResponse } from 'apps/shared/dtos/orders.dto'
import { JwtAuthGuard } from '../../security/jwt-auth.guard'
import { RolesGuard } from '../../security/roles.guard'
import { CurrentUser } from '../../security/current-user.decorator'
import type { CustomerMutatorContext } from 'apps/shared/dtos/customers.dto'
import { ListOrdersQueryDto } from './dto/list-orders-query.dto'
import { OrdersService } from './orders.service'
import { ListOrdersResponseDto } from './dto/list-orders-response.dto'
import { OrderIdParamDto } from './dto/order-id-param.dto'
import { OrderDetailResponseDto } from './dto/order-detail-response.dto'

@ApiTags('Orders')
@ApiExtraModels(ListOrdersResponseDto, OrderDetailResponseDto)
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Pobiera listę zamówień z filtrowaniem i paginacją.' })
  @ApiOkResponse({
    description: 'Lista zamówień została zwrócona poprawnie.',
    type: ListOrdersResponseDto,
    headers: {
      'Cache-Control': {
        description: 'Zalecenie wyłączenia cache po stronie klienta.',
        schema: { type: 'string', example: 'no-store' }
      }
    }
  })
  @ApiBadRequestResponse({
    description: 'Niepoprawne parametry zapytania.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'ORDERS_LIST_VALIDATION' },
        message: {
          type: 'string',
          example: 'Niepoprawne wartości parametrów filtrowania.'
        },
        details: {
          type: 'array',
          items: { type: 'string', example: 'Parametr limit nie może przekraczać 100.' }
        }
      }
    }
  })
  @ApiUnauthorizedResponse({
    description: 'Brak tokenu lub token nieprawidłowy.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Użytkownik nie jest uwierzytelniony.' },
        error: { type: 'string', example: 'Unauthorized' }
      }
    }
  })
  @ApiForbiddenResponse({
    description: 'Brak wymaganych uprawnień do danej operacji.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'ORDERS_LIST_FORBIDDEN' },
        message: {
          type: 'string',
          example: 'Brak uprawnień do przeglądania usuniętych zamówień.'
        }
      }
    }
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numer strony (1-indexed).',
    example: 1
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limit rekordów na stronie.',
    example: 25
  })
  @ApiQuery({
    name: 'customerId',
    required: false,
    type: String,
    description: 'Identyfikator klienta (UUID) do filtrowania.',
    example: '7a1afcd1-6cc5-4aef-bae2-f2e4d15d807b'
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    type: String,
    description: 'Dolna granica zakresu dat (ISO 8601).',
    example: '2024-01-01'
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    type: String,
    description: 'Górna granica zakresu dat (ISO 8601).',
    example: '2024-12-31'
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description: 'Sortowanie w formacie pole:direction (np. orderDate:desc).',
    example: 'orderDate:desc'
  })
  @ApiQuery({
    name: 'includeDeleted',
    required: false,
    type: Boolean,
    description: 'Uwzględnij zamówienia soft-delete (wymaga roli editor/owner).',
    example: false
  })
  async listOrders(
    @Query() query: ListOrdersQueryDto,
    @CurrentUser() currentUser: CustomerMutatorContext
  ): Promise<ListOrdersResponse> {
    return this.ordersService.list(query, currentUser)
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Pobiera szczegóły pojedynczego zamówienia.' })
  @ApiParam({
    name: 'orderId',
    description: 'Identyfikator zamówienia.',
    format: 'uuid'
  })
  @ApiOkResponse({
    description: 'Zwrócono szczegóły zamówienia.',
    type: OrderDetailResponseDto,
    headers: {
      'Cache-Control': {
        description: 'Zalecenie wyłączenia cache po stronie klienta.',
        schema: { type: 'string', example: 'no-store' }
      }
    }
  })
  @ApiNotFoundResponse({
    description: 'Nie znaleziono zamówienia.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'ORDER_NOT_FOUND' },
        message: { type: 'string', example: 'Nie znaleziono zamówienia.' }
      }
    }
  })
  @ApiForbiddenResponse({
    description: 'Brak uprawnień do podglądu zamówienia.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'ORDER_VIEW_FORBIDDEN' },
        message: {
          type: 'string',
          example: 'Brak uprawnień do podglądu usuniętego zamówienia.'
        }
      }
    }
  })
  async getOrder(
    @Param() params: OrderIdParamDto,
    @CurrentUser() currentUser: CustomerMutatorContext
  ): Promise<OrderResponse> {
    return this.ordersService.getById(params.orderId, currentUser)
  }
}


