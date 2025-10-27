import { Injectable } from '@nestjs/common';
import type { Session } from '@supabase/supabase-js';

import type {
  AuthLoginResponse,
  AuthenticatedUserDto,
  AuthTokensDto,
  UserRoleValue,
} from '@shared/dtos/user-roles.dto';

@Injectable()
export class AuthMapper {
  toLoginResponse(session: Session, roles: UserRoleValue[]): AuthLoginResponse {
    return {
      ...this.toTokensDto(session),
      user: this.toAuthenticatedUser(session, roles),
    };
  }

  private toTokensDto(session: Session): AuthTokensDto {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token ?? '',
      expiresIn: session.expires_in ?? 0,
    };
  }

  private toAuthenticatedUser(
    session: Session,
    roles: UserRoleValue[]
  ): AuthenticatedUserDto {
    return {
      id: session.user.id,
      email: session.user.email ?? '',
      displayName:
        session.user.user_metadata?.full_name ?? session.user.email ?? '',
      roles,
    };
  }
}
