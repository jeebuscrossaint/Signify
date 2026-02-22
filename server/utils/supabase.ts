import { createClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'

let client: ReturnType<typeof createClient<Database>> | null = null

export function useSupabaseAdmin() {
  if (!client) {
    client = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
    )
  }
  return client
}
