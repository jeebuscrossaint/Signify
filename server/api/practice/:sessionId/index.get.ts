import { requireUser } from '~~/server/utils/auth'
import { useSupabaseAdmin } from '~~/server/utils/supabase'

// Returns the full state of a practice session including all its problems
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const supabase = useSupabaseAdmin()
  const sessionId = getRouterParam(event, 'sessionId')

  if (!sessionId) {
    throw createError({ statusCode: 400, statusMessage: 'sessionId is required' })
  }

  const { data: session, error } = await supabase
    .from('practice_sessions')
    .select(`
      *,
      practice_problems (
        *,
        signs ( id, slug, display_text, sign_type, ai_mnemonic )
      )
    `)
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (error || !session) {
    throw createError({ statusCode: 404, statusMessage: 'Session not found' })
  }

  return { session }
})
