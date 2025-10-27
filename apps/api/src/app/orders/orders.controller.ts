import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiNoContentResponse,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiExtraModels,
  ApiResponse,
} from '@nestjs/swagger';

import type {
  ListOrdersResponse,
  OrderResponse,
} from '@shared/dtos/orders.dto';
import { JwtAuthGuard } from '../../security/jwt-auth.guard';
import { RolesGuard } from '../../security/roles.guard';
import { CurrentUser } from '../../security/current-user.decorator';
import type { CustomerMutatorContext } from '@shared/dtos/customers.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { OrdersService } from './orders.service';
import { ListOrdersResponseDto } from './dto/list-orders-response.dto';
import { OrderIdParamDto } from './dto/order-id-param.dto';
import { OrderDetailResponseDto } from './dto/order-detail-response.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Roles } from '../../security/roles.decorator';

@ApiTags('Orders')
@ApiExtraModels(ListOrdersResponseDto, OrderDetailResponseDto)
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({
    summary: 'Pobiera listę zamówień z filtrowaniem i paginacją.',
  })
  @ApiOkResponse({
    description: 'Lista zamówień została zwrócona poprawnie.',
    type: ListOrdersResponseDto,
    headers: {
      'Cache-Control': {
        description: 'Zalecenie wyłączenia cache po stronie klienta.',
        schema: { type: 'string', example: 'no-store' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Niepoprawne parametry zapytania.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'ORDERS_LIST_VALIDATION' },
        message: {
          type: 'string',
          example: 'Niepoprawne wartości parametrów filtrowania.',
        },
        details: {
          type: 'array',
          items: {
            type: 'string',
            example: 'Parametr limit nie może przekraczać 100.',
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Brak tokenu lub token nieprawidłowy.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: {
          type: 'string',
          example: 'Użytkownik nie jest uwierzytelniony.',
        },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiForbiddenResponse({
    description: 'Brak wymaganych uprawnień do danej operacji.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'ORDERS_LIST_FORBIDDEN' },
        message: {
          type: 'string',
          example: 'Brak uprawnień do przeglądania usuniętych zamówień.',
        },
      },
    },
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numer strony (1-indexed).',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limit rekordów na stronie.',
    example: 25,
  })
  @ApiQuery({
    name: 'customerId',
    required: false,
    type: String,
    description: 'Identyfikator klienta (UUID) do filtrowania.',
    example: '7a1afcd1-6cc5-4aef-bae2-f2e4d15d807b',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    type: String,
    description: 'Dolna granica zakresu dat (ISO 8601).',
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    type: String,
    description: 'Górna granica zakresu dat (ISO 8601).',
    example: '2024-12-31',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description: 'Sortowanie w formacie pole:direction (np. orderDate:desc).',
    example: 'orderDate:desc',
  })
  @ApiQuery({
    name: 'includeDeleted',
    required: false,
    type: Boolean,
    description:
      'Uwzględnij zamówienia soft-delete (wymaga roli editor/owner).',
    example: false,
  })
  async listOrders(
    @Query() query: ListOrdersQueryDto,
    @CurrentUser() currentUser: CustomerMutatorContext
  ): Promise<ListOrdersResponse> {
    return this.ordersService.list(query, currentUser);
  }

  @Post()
  @Roles('editor', 'owner')
  @ApiOperation({ summary: 'Tworzy nowe zamówienie.' })
  @ApiResponse({
    status: 201,
    description: 'Zamówienie zostało utworzone.',
    type: OrderDetailResponseDto,
    headers: {
      Location: {
        description: 'Adres zasobu reprezentującego utworzone zamówienie.',
        schema: {
          type: 'string',
          example: '/orders/3fa85f64-5717-4562-b3fc-2c963f66afa6',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Niepoprawne dane wejściowe.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'ORDERS_CREATE_VALIDATION' },
        message: { type: 'string', example: 'Niepoprawne dane zamówienia.' },
        details: {
          type: 'array',
          items: { type: 'string', example: 'Pole orderNo jest wymagane.' },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Brak wymaganych ról.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'ORDERS_CREATE_FORBIDDEN' },
        message: {
          type: 'string',
          example: 'Brak wymaganych ról do utworzenia zamówienia.',
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Konflikt danych (np. zduplikowany numer zamówienia).',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'ORDERS_CREATE_CONFLICT' },
        message: {
          type: 'string',
          example: 'Zamówienie o podanym numerze już istnieje.',
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Wystąpił błąd podczas tworzenia zamówienia.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'ORDERS_CREATE_FAILED' },
        message: {
          type: 'string',
          example: 'Nie udało się utworzyć zamówienia.',
        },
      },
    },
  })
  async createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser() currentUser: CustomerMutatorContext,
    @Res({ passthrough: true }) res: Response
  ): Promise<OrderResponse> {
    const result = await this.ordersService.create(dto, currentUser);
    res.status(201);
    res.setHeader('Location', `/orders/${result.id}`);
    return result;
  }

  @Put(':orderId')
  @Roles('editor', 'owner')
  @ApiOperation({ summary: 'Aktualizuje istniejące zamówienie.' })
  @ApiParam({
    name: 'orderId',
    description: 'Identyfikator zamówienia do aktualizacji.',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Zamówienie zostało zaktualizowane.',
    type: OrderDetailResponseDto,
    headers: {
      'Cache-Control': {
        description: 'Zalecenie wyłączenia cache po stronie klienta.',
        schema: { type: 'string', example: 'no-store' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Niepoprawne dane wejściowe.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'ORDERS_UPDATE_VALIDATION' },
        message: { type: 'string', example: 'Niepoprawne dane zamówienia.' },
      },
    },
  })
  @ApiForbiddenResponse({
    description: 'Brak wymaganych ról.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'ORDERS_UPDATE_FORBIDDEN' },
        message: {
          type: 'string',
          example: 'Brak wymaganych ról do aktualizacji zamówienia.',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Nie znaleziono zamówienia.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'ORDER_NOT_FOUND' },
        message: { type: 'string', example: 'Nie znaleziono zamówienia.' },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Konflikt danych (np. zduplikowany numer zamówienia).',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'ORDERS_UPDATE_CONFLICT' },
        message: {
          type: 'string',
          example: 'Zamówienie o podanym numerze już istnieje.',
        },
      },
    },
  })
  async updateOrder(
    @Param() params: OrderIdParamDto,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() currentUser: CustomerMutatorContext
  ): Promise<OrderResponse> {
    return this.ordersService.update(params.orderId, dto, currentUser);
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Pobiera szczegóły pojedynczego zamówienia.' })
  @ApiParam({
    name: 'orderId',
    description: 'Identyfikator zamówienia.',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Zwrócono szczegóły zamówienia.',
    type: OrderDetailResponseDto,
    headers: {
      'Cache-Control': {
        description: 'Zalecenie wyłączenia cache po stronie klienta.',
        schema: { type: 'string', example: 'no-store' },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Nie znaleziono zamówienia.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'ORDER_NOT_FOUND' },
        message: { type: 'string', example: 'Nie znaleziono zamówienia.' },
      },
    },
  })
  @ApiForbiddenResponse({
    description: 'Brak uprawnień do podglądu zamówienia.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'ORDER_VIEW_FORBIDDEN' },
        message: {
          type: 'string',
          example: 'Brak uprawnień do podglądu usuniętego zamówienia.',
        },
      },
    },
  })
  async getOrder(
    @Param() params: OrderIdParamDto,
    @CurrentUser() currentUser: CustomerMutatorContext
  ): Promise<OrderResponse> {
    return this.ordersService.getById(params.orderId, currentUser);
  }

  @Delete(':orderId')
  @Roles('editor', 'owner')
  @ApiOperation({ summary: 'Usuwa zamówienie (soft-delete).' })
  @ApiParam({
    name: 'orderId',
    description: 'Identyfikator zamówienia do usunięcia.',
    format: 'uuid',
  })
  @ApiNoContentResponse({
    description: 'Zamówienie zostało usunięte.',
    headers: {
      'Cache-Control': {
        description: 'Zalecenie wyłączenia cache po stronie klienta.',
        schema: { type: 'string', example: 'no-store' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Niepoprawny identyfikator zamówienia.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'array', items: { type: 'string' } },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Brak tokenu lub token nieprawidłowy.',
  })
  @ApiForbiddenResponse({
    description: 'Brak wymaganych ról do usunięcia zamówienia.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'ORDERS_DELETE_FORBIDDEN' },
        message: {
          type: 'string',
          example: 'Brak wymaganych ról do usunięcia zamówienia.',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Zamówienie nie zostało znalezione.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'ORDER_NOT_FOUND' },
        message: { type: 'string', example: 'Nie znaleziono zamówienia.' },
      },
    },
  })
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async deleteOrder(
    @Param() params: OrderIdParamDto,
    @CurrentUser() currentUser: CustomerMutatorContext
  ): Promise<void> {
    await this.ordersService.delete(params.orderId, currentUser);
  }
}
