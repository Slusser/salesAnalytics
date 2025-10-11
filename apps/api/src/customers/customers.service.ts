import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException
} from '@nestjs/common'
import { PostgrestError } from '@supabase/supabase-js'

import type {
  CreateCustomerCommand,
  CustomerDetailResponse,
  CustomerDto,
  CustomerMutatorContext,
  UpdateCustomerCommand,
  ListCustomersQuery,
  ListCustomersResponse
} from 'apps/shared/dtos/customers.dto'
import { CustomersRepository } from './customers.repository'
import { CustomerMapper } from './customers.mapper'

export class CustomerDuplicateNameError extends Error {
  readonly code = 'CUSTOMER_DUPLICATE_NAME'

  constructor(message = 'Klient o podanej nazwie już istnieje.') {
    super(message)
  }
}

export class CustomerCreateFailedError extends Error {
  readonly code = 'CUSTOMER_CREATE_FAILED'

  constructor(message = 'Nie udało się utworzyć klienta.') {
    super(message)
  }
}

export class CustomerUpdateFailedError extends Error {
  readonly code = 'CUSTOMER_UPDATE_FAILED'

  constructor(message = 'Nie udało się zaktualizować klienta.') {
    super(message)
  }
}

export class CustomersListFailedError extends Error {
  readonly code = 'CUSTOMERS_LIST_FAILED'

  constructor(message = 'Nie udało się pobrać listy klientów.') {
    super(message)
  }
}

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name)

  constructor(private readonly repository: CustomersRepository) {}

  async list(query: ListCustomersQuery, context: CustomerMutatorContext): Promise<ListCustomersResponse> {
    if (!context) {
      throw new CustomersListFailedError('Brak kontekstu użytkownika wykonującego operację.')
    }

    const page = query.page ?? 1
    const limit = query.limit ?? 25
    const includeInactive = query.includeInactive ?? false
    const search = query.search

    const isViewerOnly = !context.actorRoles.some((role) => role === 'editor' || role === 'owner')
    if (includeInactive && isViewerOnly) {
      throw new ForbiddenException('Brak wymaganych ról do wyświetlenia nieaktywnych klientów.')
    }

    this.logger.debug(
      `Listing customers: page=${page}, limit=${limit}, includeInactive=${includeInactive}, hasSearch=${
        search ? 'true' : 'false'
      }`
    )

    try {
      return await this.repository.list({
        page,
        limit,
        includeInactive,
        search
      })
    } catch (error) {
      this.logger.error('Nie udało się pobrać listy klientów', error as Error)
      throw new CustomersListFailedError()
    }
  }

  async create(command: CreateCustomerCommand, context: CustomerMutatorContext): Promise<CustomerDto> {
    if (!context) {
      throw new CustomerCreateFailedError('Brak kontekstu użytkownika wykonującego operację.')
    }

    const trimmedName = command.name.trim()
    if (!trimmedName) {
      throw new CustomerCreateFailedError('Nazwa klienta nie może być pusta.')
    }

    const isActive = command.isActive ?? true

    const exists = await this.repository.isActiveNameTaken(trimmedName)
    if (exists) {
      throw new CustomerDuplicateNameError()
    }

    const result = await this.repository.insert({
      name: trimmedName,
      isActive,
      actorId: context.actorId
    })

    if (result.error) {
      this.handleInsertError(result.error)
    }

    if (!result.data) {
      throw new CustomerCreateFailedError()
    }

    return result.data
  }

  async getById(
    customerId: string,
    context: CustomerMutatorContext | null
  ): Promise<CustomerDetailResponse> {
    if (!context) {
      throw new InternalServerErrorException({
        code: 'CUSTOMERS_GET_BY_ID_FAILED',
        message: 'Brak kontekstu użytkownika wykonującego operację.'
      })
    }

    const { data, error } = await this.repository.findById(customerId)

    if (error) {
      this.logger.error(`Nie udało się pobrać klienta ${customerId}`, error)
      throw new InternalServerErrorException({
        code: 'CUSTOMERS_GET_BY_ID_FAILED',
        message: 'Nie udało się pobrać klienta.'
      })
    }

    if (!data) {
      throw new NotFoundException({
        code: 'CUSTOMERS_GET_BY_ID_NOT_FOUND',
        message: 'Klient nie został znaleziony.'
      })
    }

    const actorRoles = context.actorRoles ?? []
    const canViewDeleted = actorRoles.some((role) => role === 'editor' || role === 'owner')

    if (data.deleted_at && !canViewDeleted) {
      throw new NotFoundException({
        code: 'CUSTOMERS_GET_BY_ID_NOT_FOUND',
        message: 'Klient nie został znaleziony.'
      })
    }

    this.logger.debug(
      `Pobieranie klienta o identyfikatorze ${customerId}, rola pozwala na usunięte: ${canViewDeleted}`
    )

    return CustomerMapper.toDto(data)
  }

  async update(
    customerId: string,
    command: UpdateCustomerCommand,
    context: CustomerMutatorContext | null
  ): Promise<CustomerDetailResponse> {
    if (!context) {
      throw new InternalServerErrorException({
        code: 'CUSTOMERS_UPDATE_FAILED',
        message: 'Brak kontekstu użytkownika wykonującego operację.'
      })
    }

    const actorRoles = context.actorRoles ?? []
    const hasMutationRole = actorRoles.some((role) => role === 'editor' || role === 'owner')

    if (!hasMutationRole) {
      throw new ForbiddenException({
        code: 'CUSTOMERS_UPDATE_FORBIDDEN',
        message: 'Brak wymaganych ról do aktualizacji klienta.'
      })
    }

    this.logger.debug(`Rozpoczęcie aktualizacji klienta ${customerId}`)

    const existing = await this.repository.findById(customerId)

    if (existing.error) {
      this.logger.error(`Nie udało się pobrać klienta ${customerId} przed aktualizacją`, existing.error)
      throw new InternalServerErrorException({
        code: 'CUSTOMERS_UPDATE_FAILED',
        message: 'Nie udało się pobrać klienta.'
      })
    }

    if (!existing.data) {
      throw new NotFoundException({
        code: 'CUSTOMERS_UPDATE_NOT_FOUND',
        message: 'Klient nie został znaleziony.'
      })
    }

    const currentCustomer = existing.data

    const isCurrentlyDeleted = Boolean(currentCustomer.deleted_at)

    if (isCurrentlyDeleted && command.isActive !== true) {
      throw new NotFoundException({
        code: 'CUSTOMERS_UPDATE_NOT_FOUND',
        message: 'Klient nie został znaleziony.'
      })
    }

    const trimmedName = command.name?.trim()
    const nextName = trimmedName === undefined ? undefined : trimmedName
    const nextIsActive = command.isActive ?? currentCustomer.is_active
    const requestedDeletedAt = command.deletedAt
    const nextDeletedAtCandidate = requestedDeletedAt ?? currentCustomer.deleted_at

    if (nextName === '') {
      throw new BadRequestException({
        code: 'CUSTOMERS_UPDATE_VALIDATION',
        message: 'Pole name nie może być puste.'
      })
    }

    if (nextDeletedAtCandidate !== null && nextIsActive !== false) {
      throw new BadRequestException({
        code: 'CUSTOMERS_UPDATE_VALIDATION',
        message: 'deletedAt może być ustawione tylko, gdy isActive=false.'
      })
    }

    const shouldCloseCustomer = command.isActive === false
    const shouldRestoreCustomer = command.isActive === true
    let computedDeletedAt = nextDeletedAtCandidate

    if (shouldCloseCustomer && requestedDeletedAt === undefined) {
      computedDeletedAt = new Date().toISOString()
    }

    if (shouldRestoreCustomer) {
      computedDeletedAt = null
    }

    if (nextName && nextName.toLowerCase() !== currentCustomer.name.toLowerCase()) {
      const nameTaken = await this.repository.isActiveNameTakenByOther(nextName, customerId)

      if (nameTaken) {
        throw new BadRequestException({
          code: 'CUSTOMERS_NAME_TAKEN',
          message: 'Klient o podanej nazwie już istnieje.'
        })
      }
    }

    const shouldUpdateDeletedAt = command.isActive !== undefined || requestedDeletedAt !== undefined

    const updatePayload: UpdateCustomerCommand = {
      name: nextName ?? undefined,
      isActive: command.isActive,
      deletedAt: shouldUpdateDeletedAt ? computedDeletedAt : undefined
    }

    const result = await this.repository.update({
      customerId,
      ...updatePayload
    })

    if (result.error) {
      this.logger.error(`Nie udało się zaktualizować klienta ${customerId}`, result.error)
      throw new InternalServerErrorException({
        code: 'CUSTOMERS_UPDATE_FAILED',
        message: 'Nie udało się zaktualizować klienta.'
      })
    }

    if (!result.data) {
      throw new NotFoundException({
        code: 'CUSTOMERS_UPDATE_NOT_FOUND',
        message: 'Klient nie został znaleziony.'
      })
    }

    this.logger.debug(`Pomyślnie zaktualizowano klienta ${customerId}`)

    return result.data
  }

  private handleInsertError(error: PostgrestError): never {
    if (error.code === '23505') {
      // unique_violation
      throw new CustomerDuplicateNameError()
    }

    this.logger.error('Nie udało się utworzyć klienta', error)
    throw new CustomerCreateFailedError()
  }
}


