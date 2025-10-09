import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './apps/db/database.types'

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient<Database>
    }
  }
}

interface ImportMetaEnv {
  readonly SUPABASE_URL: string
  readonly SUPABASE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

export {}

