import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import type { Request } from 'express'

import type { CustomerMutatorContext } from 'apps/shared/dtos/customers.dto'
import type { CurrentUserRequest } from './types'
import { RequestContextService } from './request-context.service'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly requestContext: RequestContextService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CurrentUserRequest>()
    const accessToken = this.extractAccessToken(request)

    if (!accessToken) {
      throw new UnauthorizedException('Brak tokenu uwierzytelniającego.')
    }

    const currentUser = await this.requestContext.resolveCurrentUser(accessToken)
    if (!currentUser) {
      throw new UnauthorizedException('Użytkownik nie jest uwierzytelniony.')
    }

    request.currentUser = currentUser
    return true
  }

  private extractAccessToken(request: Request): string | undefined {
    const authHeader = request.headers.authorization ?? ''
    const [scheme, token] = authHeader.split(' ')

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return undefined
    }

    return token
  }
}


