import { requireUser } from '~~/server/utils/auth'
import { useSupabaseAdmin } from '~~/server/utils/supabase'

// Returns a single user lesson with all sign data and fresh signed video URLs
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const supabase = useSupabaseAdmin()
  const userLessonId = getRouterParam(event, 'userLessonId')

  if (!userLessonId) {
    throw createError({ statusCode: 400, statusMessage: 'userLessonId is required' })
  }

  const { data: userLesson, error } = await supabase
    .from('user_lessons')
    .select(`
      *,
      lesson:lesson_id (
        *,
        lesson_signs ( *, signs ( * ) )
      )
    `)
    .eq('id', userLessonId)
    .eq('user_id', user.id)
    .single()

  if (error || !userLesson) {
    throw createError({ statusCode: 404, statusMessage: 'Lesson not found' })
  }

  // Generate fresh signed video URLs for each sign in the lesson
  const lesson = userLesson.lesson as any
  const signsWithUrls = await Promise.all(
    (lesson?.lesson_signs ?? []).map(async (ls: any) => {
      const sign = ls.signs
      let videoUrl: string | null = null
      if (sign?.video_path) {
        const { data: urlData } = await supabase.storage
          .from('sign-videos')
          .createSignedUrl(sign.video_path, 3600)
        videoUrl = urlData?.signedUrl ?? null
      }
      return { ...ls, signs: { ...sign, videoUrl } }
    })
  )

  return {
    ...userLesson,
    lesson: { ...lesson, lesson_signs: signsWithUrls },
  }
})
