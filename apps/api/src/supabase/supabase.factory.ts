import { Injectable } from '@nestjs/common'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from 'apps/db/database.types'

const supabaseUrl = process.env.SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.SUPABASE_KEY ?? ''

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Brak konfiguracji Supabase: SUPABASE_URL lub SUPABASE_KEY.')
}

@Injectable()
export class SupabaseFactory {
  create(accessToken?: string): SupabaseClient<Database> {
    return createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      global: accessToken
        ? {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        : undefined
    })
  }
}


