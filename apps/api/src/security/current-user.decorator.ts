import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { CustomerMutatorContext } from 'apps/shared/dtos/customers.dto';
import type { CurrentUserRequest } from './types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CustomerMutatorContext => {
    const request = ctx.switchToHttp().getRequest<CurrentUserRequest>();
    const currentUser = request.currentUser;

    if (!currentUser) {
      throw new UnauthorizedException('Brak uwierzytelnionego użytkownika.');
    }

    return currentUser;
  }
);
