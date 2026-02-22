import { defineEventHandler, createError } from 'h3'
import { requireUser } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'

// Returns the authenticated user's profile, streak, and basic stats
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const supabase = useSupabaseAdmin()

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    throw createError({ statusCode: 404, statusMessage: 'User profile not found' })
  }

  const { data: streak } = await supabase
    .from('streaks')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return { profile, streak: streak ?? null }
})
