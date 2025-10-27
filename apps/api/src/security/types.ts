import type { Request } from 'express';

import type { CustomerMutatorContext } from '@shared/dtos/customers.dto';

declare module 'express-serve-static-core' {
  interface Request {
    currentUser?: CustomerMutatorContext;
  }
}

export type CurrentUserRequest = Request & {
  currentUser?: CustomerMutatorContext;
};
