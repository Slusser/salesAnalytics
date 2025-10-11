import { Body, Controller, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger'

import type { CustomerDto, CustomerMutatorContext } from 'apps/shared/dtos/customers.dto'
import { CreateCustomerDto } from './dto/create-customer.dto'
import { CustomersService } from './customers.service'
import { JwtAuthGuard } from '../security/jwt-auth.guard'
import { RolesGuard } from '../security/roles.guard'
import { Roles } from '../security/roles.decorator'
import { CurrentUser } from '../security/current-user.decorator'

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

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


