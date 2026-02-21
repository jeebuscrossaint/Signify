import { createClient } from '@supabase/supabase-js'

export function useSupabaseAdmin() {
  const config = useRuntimeConfig()

  return createClient(
    config.public.supabaseUrl as string,
    config.supabaseServiceKey as string,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    }
  )
}

export function useSupabaseUser(jwt: string) {
  const config = useRuntimeConfig()

  return createClient(
    config.public.supabaseUrl as string,
    config.public.supabaseAnonKey as string,
    {
      global: {
        headers: { Authorization: `Bearer ${jwt}` }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    }
  )
}