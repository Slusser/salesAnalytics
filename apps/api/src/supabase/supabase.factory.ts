import { Injectable } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@db/database.types';

const supabaseUrl = process.env.SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.SUPABASE_KEY ?? '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Brak konfiguracji Supabase: SUPABASE_URL lub SUPABASE_KEY.');
}

type CreateClientOptions = {
  serviceRole?: boolean;
};

@Injectable()
export class SupabaseFactory {
  create(
    accessToken?: string,
    options?: CreateClientOptions
  ): SupabaseClient<Database> {
    const useServiceRole = options?.serviceRole ?? false;

    if (useServiceRole && !supabaseServiceRoleKey) {
      throw new Error(
        'Brak SUPABASE_SERVICE_ROLE_KEY wymaganej do operacji service-role.'
      );
    }

    const apiKey = useServiceRole ? supabaseServiceRoleKey : supabaseAnonKey;

    return createClient<Database>(supabaseUrl, apiKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: accessToken
        ? {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        : undefined,
    });
  }
}
