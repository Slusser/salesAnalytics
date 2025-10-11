import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from './database.types'

const supabaseUrl = process.env.SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.SUPABASE_KEY ?? ''

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Brak konfiguracji Supabase: SUPABASE_URL lub SUPABASE_KEY.')
}

export const createSupabaseClient = (accessToken?: string): SupabaseClient<Database> =>
  createClient<Database>(supabaseUrl, supabaseAnonKey, {
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

export const supabaseClient = createSupabaseClient()

