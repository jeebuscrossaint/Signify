import { requireUser } from '~~/server/utils/auth'
import { useSupabaseAdmin } from '~~/server/utils/supabase'

// Creates a new standalone practice session linked to a past lesson.
// This lets users re-drill a lesson they already completed.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const supabase = useSupabaseAdmin()
  const userLessonId = getRouterParam(event, 'userLessonId')

  if (!userLessonId) {
    throw createError({ statusCode: 400, statusMessage: 'userLessonId is required' })
  }

  // Confirm the user_lesson belongs to this user
  const { data: userLesson, error: fetchError } = await supabase
    .from('user_lessons')
    .select('id, lesson_id, status')
    .eq('id', userLessonId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !userLesson) {
    throw createError({ statusCode: 404, statusMessage: 'Lesson not found' })
  }

  // Create a new practice session of type post_lesson linked to this user_lesson
  const { data: session, error: sessionError } = await supabase
    .from('practice_sessions')
    .insert({
      user_id: user.id,
      user_lesson_id: userLessonId,
      session_type: 'post_lesson',
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (sessionError || !session) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create practice session' })
  }

  return { sessionId: session.id, session }
})
