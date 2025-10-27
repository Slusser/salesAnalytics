import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';

import type {
  AuthLoginCommand,
  AuthLoginResponse,
  AuthLogoutCommand,
  AuthLogoutResponse,
  UserRoleValue,
} from 'apps/shared/dtos/user-roles.dto';

import { SupabaseFactory } from '../supabase/supabase.factory';
import { AuthMapper } from './auth.mapper';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabaseFactory: SupabaseFactory,
    private readonly mapper: AuthMapper
  ) {}

  async login(command: AuthLoginCommand): Promise<AuthLoginResponse> {
    const supabase = this.supabaseFactory.create();

    const signInResult = await supabase.auth.signInWithPassword({
      email: command.email,
      password: command.password,
    });

    if (signInResult.error) {
      this.logger.warn(
        `Nieudane logowanie użytkownika ${command.email}`,
        signInResult.error
      );
      throw this.mapSignInError(signInResult.error.message);
    }

    const session = signInResult.data.session;
    if (!session) {
      this.logger.error('Brak sesji w odpowiedzi Supabase', signInResult);
      throw new UnauthorizedException({
        code: 'invalid_credentials',
        message: 'Nieprawidłowe dane logowania.',
      });
    }

    const roles = await this.fetchUserRoles(
      session.user.id,
      session.access_token
    );
    const dto = this.mapper.toLoginResponse(session, roles);

    return dto;
  }

  async logout(_command: AuthLogoutCommand): Promise<AuthLogoutResponse> {
    // Supabase w trybie client-side nie wspiera unieważniania refresh tokenów bezpośrednio z API MVP
    // W przyszłości można dodać integrację z Supabase Admin API.
    return { success: true };
  }

  private async fetchUserRoles(
    userId: string,
    accessToken: string
  ): Promise<UserRoleValue[]> {
    let supabase = this.supabaseFactory.create(accessToken);
    let { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) {
      this.logger.debug(
        `[fetchUserRoles] Błąd podczas pobierania ról (pierwsza próba, accessToken usera) dla userId=${userId}:`,
        error
      );
    }

    if (error?.code === '42P17') {
      this.logger.warn(
        `RLS dla user_roles utknęło w rekursji przy tokenie użytkownika ${userId}. Próbuję odczytu z kluczem serwisowym.`,
        error
      );

      supabase = this.supabaseFactory.create();
      ({ data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId));

      if (error) {
        this.logger.debug(
          `[fetchUserRoles] Błąd podczas pobierania ról (druga próba, service token) dla userId=${userId}:`,
          error
        );
      }
    }

    if (error) {
      this.logger.error('Błąd pobierania ról użytkownika', error);
      throw new UnauthorizedException({
        code: 'invalid_credentials',
        message: 'Nieprawidłowe dane logowania.',
      });
    }

    if (!data || data.length === 0) {
      this.logger.warn(
        `Użytkownik ${userId} nie posiada przypisanych ról. Zwracam pustą listę.`
      );
      return [];
    }

    return data.map((row) => row.role as UserRoleValue);
  }

  private mapSignInError(message: string): UnauthorizedException {
    const normalized = message.toLowerCase();
    let code: 'invalid_credentials' | 'wrong_passoword' | 'user_not_found' =
      'invalid_credentials';

    if (normalized.includes('invalid login credentials')) {
      code = 'wrong_passoword';
    }

    if (normalized.includes('user not found')) {
      code = 'user_not_found';
    }

    return new UnauthorizedException({
      code,
      message: 'Nieprawidłowe dane logowania.',
    });
  }
}
