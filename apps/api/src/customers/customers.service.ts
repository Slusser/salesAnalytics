import { Injectable, Logger } from '@nestjs/common'
import { PostgrestError } from '@supabase/supabase-js'

import type {
  CreateCustomerCommand,
  CustomerDto,
  CustomerMutatorContext
} from 'apps/shared/dtos/customers.dto'
import { CustomersRepository } from './customers.repository'

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

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name)

  constructor(private readonly repository: CustomersRepository) {}

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

  private handleInsertError(error: PostgrestError): never {
    if (error.code === '23505') {
      // unique_violation
      throw new CustomerDuplicateNameError()
    }

    this.logger.error('Nie udało się utworzyć klienta', error)
    throw new CustomerCreateFailedError()
  }
}


