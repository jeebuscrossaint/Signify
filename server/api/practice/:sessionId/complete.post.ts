import { requireUser } from '~~/server/utils/auth'
import { useSupabaseAdmin } from '~~/server/utils/supabase'
import { awardXP, XP } from '~~/server/utils/xp'
import { updateStreak } from '~~/server/utils/streak'
import { checkStageAdvancement } from '~~/server/utils/mastery'

// Finalizes a practice session: computes score, awards XP, updates streak,
// marks practice_done on the linked user_lesson if applicable, and checks for stage advancement.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const supabase = useSupabaseAdmin()
  const sessionId = getRouterParam(event, 'sessionId')

  if (!sessionId) {
    throw createError({ statusCode: 400, statusMessage: 'sessionId is required' })
  }

  // Fetch the session and all its problems
  const { data: session, error: fetchError } = await supabase
    .from('practice_sessions')
    .select('*, practice_problems(*)')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !session) {
    throw createError({ statusCode: 404, statusMessage: 'Session not found' })
  }

  if (session.status === 'completed') {
    throw createError({ statusCode: 409, statusMessage: 'Session already completed' })
  }

  const problems = (session.practice_problems as any[]) ?? []
  const answeredProblems = problems.filter((p) => p.is_correct !== null && p.is_correct !== undefined)
  const correctCount = answeredProblems.filter((p) => p.is_correct === true).length
  const totalAnswered = answeredProblems.length || 1 // avoid divide-by-zero
  const score = correctCount / totalAnswered
  const isPerfect = correctCount === problems.length && problems.length > 0

  // XP calculation
  let xpAmount = XP.PRACTICE_COMPLETE_BASE + correctCount * XP.PER_CORRECT_ANSWER
  if (isPerfect) xpAmount += XP.PERFECT_PRACTICE_BONUS

  const { data: updated, error: updateError } = await supabase
    .from('practice_sessions')
    .update({
      status: 'completed',
      correct_count: correctCount,
      score,
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .select()
    .single()

  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to complete session' })
  }

  // If this session was linked to a user_lesson, mark practice_done on it
  if (session.user_lesson_id) {
    await supabase
      .from('user_lessons')
      .update({ practice_done: true })
      .eq('id', session.user_lesson_id)
  }

  const [{ xp, level }, streak] = await Promise.all([
    awardXP(user.id, xpAmount),
    updateStreak(user.id),
  ])

  // Check if this session's progress triggers a learning stage advancement
  const newStage = await checkStageAdvancement(user.id)

  return {
    session: updated,
    score,
    correctCount,
    totalProblems: problems.length,
    xp,
    level,
    streak,
    newStage, // non-null if the user just advanced to a new learning stage
  }
})
