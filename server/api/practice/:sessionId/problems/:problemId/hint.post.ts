import { requireUser } from '~~/server/utils/auth'
import { useSupabaseAdmin } from '~~/server/utils/supabase'

// Increments hints_used on a problem and returns the sign's mnemonic
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const supabase = useSupabaseAdmin()
  const sessionId = getRouterParam(event, 'sessionId')
  const problemId = getRouterParam(event, 'problemId')

  if (!sessionId || !problemId) {
    throw createError({ statusCode: 400, statusMessage: 'sessionId and problemId are required' })
  }

  // Verify session ownership
  const { data: session } = await supabase
    .from('practice_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Session not found' })
  }

  const { data: problem } = await supabase
    .from('practice_problems')
    .select('id, hints_used, sign_id, signs(ai_mnemonic, ai_description)')
    .eq('id', problemId)
    .eq('session_id', sessionId)
    .single()

  if (!problem) {
    throw createError({ statusCode: 404, statusMessage: 'Problem not found' })
  }

  await supabase
    .from('practice_problems')
    .update({ hints_used: (problem.hints_used ?? 0) + 1 })
    .eq('id', problemId)

  const sign = problem.signs as any
  return {
    hint: sign?.ai_mnemonic ?? sign?.ai_description ?? 'No hint available yet.',
  }
})
