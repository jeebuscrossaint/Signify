import { requireUser } from '~~/server/utils/auth'
import { useSupabaseAdmin } from '~~/server/utils/supabase'

// Returns the full state of a practice session including all its problems.
// Signed video URLs are generated inline here (same approach as the lesson endpoint)
// so the client never needs a separate round-trip to fetch them.
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
        signs ( id, slug, display_text, sign_type, ai_mnemonic, video_path )
      )
    `)
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (error || !session) {
    throw createError({ statusCode: 404, statusMessage: 'Session not found' })
  }

  // Generate signed video URLs for each problem whose sign has a video_path
  const problemsWithUrls = await Promise.all(
    (session.practice_problems as any[]).map(async (problem: any) => {
      const sign = problem.signs
      let videoUrl: string | null = null
      if (sign?.video_path) {
        const { data: urlData } = await supabase.storage
          .from('sign-videos')
          .createSignedUrl(sign.video_path, 3600)
        videoUrl = urlData?.signedUrl ?? null
      }
      return { ...problem, signs: { ...sign, videoUrl } }
    })
  )

  return { session: { ...session, practice_problems: problemsWithUrls } }
})
