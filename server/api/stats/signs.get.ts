import { requireUser } from '~~/server/utils/auth'
import { useSupabaseAdmin } from '~~/server/utils/supabase'

// Returns the full mastery breakdown for all signs the user has encountered.
// Used by the sign progress grid on the stats page.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const supabase = useSupabaseAdmin()

  const { data, error } = await supabase
    .from('user_sign_progress')
    .select(`
      id,
      mastery_status,
      mastery_score,
      times_seen,
      times_correct,
      times_incorrect,
      last_practiced,
      signs (
        id,
        slug,
        display_text,
        sign_type,
        category,
        difficulty
      )
    `)
    .eq('user_id', user.id)
    .order('last_practiced', { ascending: false })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to fetch sign progress' })
  }

  return { signs: data ?? [] }
})
