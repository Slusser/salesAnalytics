import { Injectable, Logger } from '@nestjs/common'
import type { Session } from '@supabase/supabase-js'

import type { CustomerMutatorContext } from 'apps/shared/dtos/customers.dto'
import type { UserRoleValue } from 'apps/shared/dtos/user-roles.dto'
import type { SupabaseClient } from '@supabase/supabase-js'

import { SupabaseFactory } from '../supabase/supabase.factory'

interface UserRolesResponse {
  role: UserRoleValue
}

@Injectable()
export class RequestContextService {
  private readonly logger = new Logger(RequestContextService.name)

  constructor(private readonly supabaseFactory: SupabaseFactory) {}

  async resolveCurrentUser(accessToken: string): Promise<CustomerMutatorContext | undefined> {
    const supabase = this.supabaseFactory.create(accessToken)

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !sessionData?.session) {
      this.logger.warn('Nie udało się pobrać sesji użytkownika', sessionError)
      return undefined
    }

    const session = sessionData.session

    const userRoles = await this.fetchUserRoles(supabase, session)
    if (!userRoles) {
      return undefined
    }

    return {
      actorId: session.user.id,
      actorRoles: userRoles
    }
  }

  private async fetchUserRoles(
    supabase: SupabaseClient,
    session: Session
  ): Promise<UserRoleValue[] | undefined> {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)

    if (error) {
      this.logger.error('Błąd pobierania ról użytkownika', error)
      return undefined
    }

    const roles = data?.map((row: UserRolesResponse) => row.role) ?? []

    if (roles.length === 0) {
      this.logger.warn(`Użytkownik ${session.user.id} nie posiada przypisanych ról.`)
    }

    return roles
  }
}


