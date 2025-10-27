import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ROLES_KEY } from './roles.decorator';
import type { CustomerMutatorContext } from '@shared/dtos/customers.dto';
import type { CurrentUserRequest } from './types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<CurrentUserRequest>();
    const currentUser = request.currentUser as
      | CustomerMutatorContext
      | undefined;

    if (!currentUser) {
      throw new ForbiddenException('Brak uprawnień do wykonania operacji.');
    }

    const hasRole = currentUser.actorRoles.some((role) =>
      requiredRoles.includes(role)
    );

    if (!hasRole) {
      throw new ForbiddenException(
        'Brak wymaganych ról do wykonania operacji.'
      );
    }

    return true;
  }
}
