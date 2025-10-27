import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { CustomerMutatorContext } from '@shared/dtos/customers.dto';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { CurrentUserRequest } from './types';
import { RequestContextService } from './request-context.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly requestContext: RequestContextService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CurrentUserRequest>();
    if (this.isPublic(context)) {
      return true;
    }

    const accessToken = this.extractAccessToken(request);

    if (!accessToken) {
      throw new UnauthorizedException('Brak tokenu uwierzytelniającego.');
    }

    const currentUser = await this.requestContext.resolveCurrentUser(
      accessToken
    );
    if (!currentUser) {
      throw new UnauthorizedException('Użytkownik nie jest uwierzytelniony.');
    }

    request.currentUser = currentUser;
    return true;
  }

  private extractAccessToken(request: Request): string | undefined {
    const authHeader = request.headers.authorization ?? '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return undefined;
    }

    return token;
  }

  private isPublic(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const controller = context.getClass();
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        handler,
        controller,
      ]) ?? false
    );
  }
}
