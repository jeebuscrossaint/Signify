import { requireUser } from '~~/server/utils/auth'
import { useSupabaseAdmin } from '~~/server/utils/supabase'
import { awardXP, XP } from '~~/server/utils/xp'
import { updateStreak } from '~~/server/utils/streak'

// Marks a lesson as completed, awards XP, and updates the streak.
// Body: { score } — optional 0.0 to 1.0 float from the frontend (based on practice gate results)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const supabase = useSupabaseAdmin()
  const userLessonId = getRouterParam(event, 'userLessonId')
  const body = await readBody(event)

  if (!userLessonId) {
    throw createError({ statusCode: 400, statusMessage: 'userLessonId is required' })
  }

  // Verify ownership and current status
  const { data: userLesson, error: fetchError } = await supabase
    .from('user_lessons')
    .select('id, status, lesson_id')
    .eq('id', userLessonId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !userLesson) {
    throw createError({ statusCode: 404, statusMessage: 'Lesson not found' })
  }

  if (userLesson.status === 'completed') {
    throw createError({ statusCode: 409, statusMessage: 'Lesson already completed' })
  }

  // Count how many signs are in this lesson so we can calculate XP
  const { count: signCount } = await supabase
    .from('lesson_signs')
    .select('id', { count: 'exact', head: true })
    .eq('lesson_id', userLesson.lesson_id ?? '')

  const score = typeof body?.score === 'number' ? Math.min(1, Math.max(0, body.score)) : null

  // XP: base + per sign bonus
  const xpAmount = XP.LESSON_COMPLETE_BASE + (signCount ?? 0) * XP.PER_SIGN_TAUGHT

  const { data: updated, error: updateError } = await supabase
    .from('user_lessons')
    .update({
      status: 'completed',
      score,
      xp_earned: xpAmount,
      completed_at: new Date().toISOString(),
    })
    .eq('id', userLessonId)
    .select()
    .single()

  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to complete lesson' })
  }

  const [{ xp, level }, streak] = await Promise.all([
    awardXP(user.id, xpAmount),
    updateStreak(user.id),
  ])

  return { userLesson: updated, xp, level, streak }
})
