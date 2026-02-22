import { serverSupabaseUser } from '#supabase/server'
import type { H3Event } from 'h3'

// Validates the request JWT and returns the authenticated user.
// Note: @nuxtjs/supabase v2 serverSupabaseUser returns JWT claims (JwtPayload),
// not a User object. Claims use `sub` for the user UUID, so we normalize it to `id`.
export async function requireUser(event: H3Event) {
  const claims = await serverSupabaseUser(event)
  if (!claims?.sub) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  // Expose `id` so all route handlers can use user.id uniformly
  return { ...claims, id: claims.sub }
}
