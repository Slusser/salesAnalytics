import { Injectable, Logger } from '@nestjs/common';

import type { CustomerMutatorContext } from '@shared/dtos/customers.dto';
import type { UserRoleValue } from '@shared/dtos/user-roles.dto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SupabaseFactory } from '../supabase/supabase.factory';

interface UserRolesResponse {
  role: UserRoleValue;
}

@Injectable()
export class RequestContextService {
  private readonly logger = new Logger(RequestContextService.name);

  constructor(private readonly supabaseFactory: SupabaseFactory) {}

  async resolveCurrentUser(
    accessToken: string
  ): Promise<CustomerMutatorContext | undefined> {
    const supabase = this.supabaseFactory.create(accessToken);

    const { data: userData, error: userError } = await supabase.auth.getUser(
      accessToken
    );

    if (userError || !userData?.user) {
      this.logger.warn(
        'Nie udało się pobrać użytkownika z tokenu dostępowego',
        {
          error: userError?.message,
        }
      );
      return undefined;
    }

    const userId = userData.user.id;

    const userRoles = await this.fetchUserRoles(supabase, userId);
    if (!userRoles) {
      return undefined;
    }

    return {
      actorId: userId,
      actorRoles: userRoles,
      accessToken,
    };
  }

  private async fetchUserRoles(
    supabase: SupabaseClient,
    userId: string
  ): Promise<UserRoleValue[] | undefined> {
    let { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error?.code === '42P17') {
      this.logger.warn(
        `RLS dla user_roles utknęło w rekursji przy tokenie użytkownika ${userId}. Próbuję odczytu z kluczem serwisowym.`,
        error
      );

      const serviceClient = this.supabaseFactory.create(undefined, {
        serviceRole: true,
      });

      ({ data, error } = await serviceClient
        .from('user_roles')
        .select('role')
        .eq('user_id', userId));
    }

    if (error) {
      this.logger.error('Błąd pobierania ról użytkownika', error);
      return undefined;
    }

    const roles = data?.map((row: UserRolesResponse) => row.role) ?? [];

    if (roles.length === 0) {
      this.logger.warn(`Użytkownik ${userId} nie posiada przypisanych ról.`);
    }

    return roles;
  }
}
