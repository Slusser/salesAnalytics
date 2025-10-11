import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards
} from '@nestjs/common'
import type { Response } from 'express'
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger'
import { plainToInstance } from 'class-transformer'

import type {
  CustomerDetailResponse,
  CustomerDto,
  CustomerMutatorContext
} from 'apps/shared/dtos/customers.dto'
import { CreateCustomerDto } from './dto/create-customer.dto'
import { CustomersService } from './customers.service'
import { JwtAuthGuard } from '../security/jwt-auth.guard'
import { RolesGuard } from '../security/roles.guard'
import { Roles } from '../security/roles.decorator'
import { CurrentUser } from '../security/current-user.decorator'
import { ListCustomersQueryDto } from './dto/list-customers-query.dto'
import { ListCustomersResponseDto, CustomerResponseDto } from './dto/list-customers-response.dto'
import { CustomerIdParamDto } from './dto/customer-id-param.dto'
import { UpdateCustomerDto } from './dto/update-customer.dto'

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get(':customerId')
  @Roles('viewer', 'editor', 'owner')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Pobierz szczegóły klienta.' })
  @ApiParam({
    name: 'customerId',
    description: 'Identyfikator klienta.',
    format: 'uuid',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6'
  })
  @ApiOkResponse({
    description: 'Szczegóły klienta zostały pobrane pomyślnie.',
    type: CustomerResponseDto
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Klient nie został znaleziony lub jest ukryty dla roli viewer.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'CUSTOMERS_GET_BY_ID_NOT_FOUND' },
        message: { type: 'string', example: 'Klient nie został znaleziony.' }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Nie udało się pobrać klienta.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'CUSTOMERS_GET_BY_ID_FAILED' },
        message: { type: 'string', example: 'Nie udało się pobrać klienta.' }
      }
    }
  })
  async getById(
    @Param() params: CustomerIdParamDto,
    @CurrentUser() currentUser: CustomerMutatorContext
  ): Promise<CustomerDetailResponse> {
    const result = await this.customersService.getById(params.customerId, currentUser)
    return result
  }

  @Put(':customerId')
  @Roles('editor', 'owner')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Zaktualizuj istniejącego klienta.' })
  @ApiParam({
    name: 'customerId',
    description: 'Identyfikator klienta.',
    format: 'uuid',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6'
  })
  @ApiOkResponse({
    description: 'Klient został zaktualizowany.',
    type: CustomerResponseDto
  })
  @ApiBody({
    type: UpdateCustomerDto,
    description: 'Dane aktualizowanego klienta.'
  })
  @ApiBadRequestResponse({
    description: 'Niepoprawne dane wejściowe.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'CUSTOMERS_UPDATE_VALIDATION' },
        message: {
          type: 'string',
          example: 'Pole name nie może być puste.'
        }
      }
    }
  })
  @ApiForbiddenResponse({
    description: 'Brak uprawnień do aktualizacji klienta.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'CUSTOMERS_UPDATE_FORBIDDEN' },
        message: {
          type: 'string',
          example: 'Brak wymaganych ról do aktualizacji klienta.'
        }
      }
    }
  })
  @ApiNotFoundResponse({
    description: 'Klient nie został znaleziony.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'CUSTOMERS_UPDATE_NOT_FOUND' },
        message: { type: 'string', example: 'Klient nie został znaleziony.' }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Błąd serwera podczas aktualizacji klienta.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'CUSTOMERS_UPDATE_FAILED' },
        message: { type: 'string', example: 'Nie udało się zaktualizować klienta.' }
      }
    }
  })
  async update(
    @Param() params: CustomerIdParamDto,
    @Body() body: UpdateCustomerDto,
    @CurrentUser() currentUser: CustomerMutatorContext
  ): Promise<CustomerDetailResponse> {
    return this.customersService.update(params.customerId, body, currentUser)
  }

  @Get()
  @Roles('viewer', 'editor', 'owner')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Pobierz listę klientów z paginacją i opcjonalnym filtrem.' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numer strony (domyślnie 1).'
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limit rekordów na stronie (domyślnie 25, max 100).'
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Fraza wyszukiwania dopasowywana do nazwy klienta (case-insensitive).'
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Czy uwzględnić klientów nieaktywnych (wymaga ról editor/owner).'
  })
  @ApiOkResponse({
    description: 'Lista klientów została pobrana pomyślnie.',
    type: ListCustomersResponseDto
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Brak autoryzacji.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'UNAUTHORIZED' },
        message: {
          type: 'string',
          example: 'Użytkownik nie jest uwierzytelniony.'
        }
      }
    }
  })
  @ApiForbiddenResponse({
    description: 'Brak wymaganych ról do wyświetlenia nieaktywnych klientów.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'FORBIDDEN' },
        message: {
          type: 'string',
          example: 'Brak wymaganych ról do wyświetlenia nieaktywnych klientów.'
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Niepoprawne parametry zapytania.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'CUSTOMERS_LIST_VALIDATION' },
        message: { type: 'string', example: 'Parametr page musi być większy lub równy 1.' }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Błąd serwera podczas pobierania listy klientów.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'CUSTOMERS_LIST_FAILED' },
        message: { type: 'string', example: 'Nie udało się pobrać listy klientów.' }
      }
    }
  })
  async list(
    @Query() query: ListCustomersQueryDto,
    @CurrentUser() currentUser: CustomerMutatorContext
  ): Promise<ListCustomersResponseDto> {
    const result = await this.customersService.list(query, currentUser)
    return plainToInstance(ListCustomersResponseDto, result)
  }

  @Post()
  @Roles('owner', 'editor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Utwórz nowego klienta' })
  @ApiBody({
    type: CreateCustomerDto,
    description: 'Dane nowego klienta'
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Klient został utworzony.',
    schema: {
      $ref: '#/components/schemas/CustomerDto'
    }
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Niepoprawne dane wejściowe.',
    schema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          example: 'CUSTOMER_VALIDATION_ERROR'
        },
        message: {
          type: 'string',
          example: 'Nazwa klienta nie może być pusta.'
        },
        details: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Brak autoryzacji.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'UNAUTHORIZED' },
        message: { type: 'string', example: 'Użytkownik nie jest uwierzytelniony.' }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Brak uprawnień do wykonania operacji.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'FORBIDDEN' },
        message: { type: 'string', example: 'Brak wymaganych ról do wykonania operacji.' }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Błąd serwera podczas tworzenia klienta.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'CUSTOMER_CREATE_FAILED' },
        message: { type: 'string', example: 'Nie udało się utworzyć klienta.' }
      }
    }
  })
  async create(
    @Body() createCustomerDto: CreateCustomerDto,
    @CurrentUser() currentUser: CustomerMutatorContext,
    @Res({ passthrough: true }) res: Response
  ): Promise<CustomerDto> {
    const { name, isActive = true } = createCustomerDto

    const result = await this.customersService.create(
      { name, isActive },
      currentUser
    )

    res.location(`/customers/${result.id}`)
    return result
  }
}


