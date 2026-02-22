import { serverSupabaseUser } from '#supabase/server'
import type { H3Event } from 'h3'

// Validates the request JWT and returns the authenticated user.
// Throws a 401 if the token is missing or invalid.
export async function requireUser(event: H3Event) {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return user
}
