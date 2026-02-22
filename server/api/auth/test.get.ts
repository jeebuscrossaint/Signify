export default defineEventHandler(async () => {
  const url = process.env.SUPABASE_URL
  const keyRaw = process.env.SUPABASE_SECRET_KEY

  if (!url || !keyRaw) {
    return {
      ok: false,
      error: 'Missing env vars',
      SUPABASE_URL: url ?? 'MISSING',
      SUPABASE_SECRET_KEY: keyRaw ? 'present' : 'MISSING',
    }
  }

  // Validate the key looks like a complete JWT (3 dot-separated segments)
  const parts = keyRaw.split('.')
  const keyValid = parts.length === 3 && parts.every(p => p.length > 0)

  // Try a simple admin API call
  const supabase = useSupabaseAdmin()
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })

  return {
    ok: !error,
    SUPABASE_URL: url,
    key_starts_with: keyRaw.slice(0, 10) + '...',
    key_jwt_valid: keyValid,
    key_length: keyRaw.length,
    supabase_error: error?.message ?? null,
    user_count_sample: data?.users?.length ?? null,
  }
})
