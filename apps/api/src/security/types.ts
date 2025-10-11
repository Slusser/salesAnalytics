/* eslint-disable import/no-unresolved */
import type { Request } from 'express'

import type { CustomerMutatorContext } from 'apps/shared/dtos/customers.dto'
declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
    interface Request {
      currentUser?: CustomerMutatorContext
    }
  }
}

export type CurrentUserRequest = Request & {
  currentUser?: CustomerMutatorContext
}


