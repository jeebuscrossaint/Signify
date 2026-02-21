import { requireUser } from '~/../server/utils/auth'
import { useSupabaseAdmin } from '~/../server/utils/supabase'

export default defineEventHandler(async (event) => {
  const authUser = await requireUser(event)
  const supabase = useSupabaseAdmin()

  const [{ data: profile, error: profileError }, { data: streak }] = await Promise.all([
    supabase.from('users').select('*').eq('id', authUser.id).single(),
    supabase.from('streaks').select('*').eq('user_id', authUser.id).single(),
  ])

  if (profileError) throw createError({ statusCode: 404, message: 'Profile not found' })

  return { profile, streak }
})