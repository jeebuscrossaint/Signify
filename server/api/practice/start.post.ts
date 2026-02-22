import { requireUser } from '~~/server/utils/auth'
import { useSupabaseAdmin } from '~~/server/utils/supabase'

// Randomly pick n items from an array without replacement
function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(n, shuffled.length))
}

// Selects a problem type based on the user's learning stage
function pickProblemType(learningStage: string): string {
  const types = learningStage === 'sentences'
    ? ['watch_and_type', 'sign_to_camera', 'sentence_sign']
    : ['watch_and_type', 'sign_to_camera']
  return (types[Math.floor(Math.random() * types.length)] ?? 'watch_and_type')
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const supabase = useSupabaseAdmin()
  const body = await readBody(event)

  const { session_type, user_lesson_id } = body ?? {}

  if (!session_type || !['post_lesson', 'standalone'].includes(session_type)) {
    throw createError({ statusCode: 400, statusMessage: 'session_type must be post_lesson or standalone' })
  }

  if (session_type === 'post_lesson' && !user_lesson_id) {
    throw createError({ statusCode: 400, statusMessage: 'user_lesson_id is required for post_lesson sessions' })
  }

  // Fetch user profile for learning_stage
  const { data: profile } = await supabase
    .from('users')
    .select('learning_stage')
    .eq('id', user.id)
    .single()

  const learningStage = profile?.learning_stage ?? 'letters'

  // Total problem count — random between 5 and 10
  const totalProblems = Math.floor(Math.random() * 6) + 5

  let newSignIds: string[] = []
  let lessonId: string | null = null

  // For post_lesson: get the signs that were in the linked lesson
  if (session_type === 'post_lesson' && user_lesson_id) {
    const { data: ul } = await supabase
      .from('user_lessons')
      .select('lesson_id')
      .eq('id', user_lesson_id)
      .eq('user_id', user.id)
      .single()

    if (!ul) {
      throw createError({ statusCode: 404, statusMessage: 'user_lesson not found' })
    }

    lessonId = ul.lesson_id ?? null
    const { data: lsRows } = await supabase
      .from('lesson_signs')
      .select('sign_id')
      .eq('lesson_id', lessonId ?? '')

    newSignIds = (lsRows ?? []).map((r) => r.sign_id).filter(Boolean) as string[]
  }

  // Fetch user's sign progress
  const { data: progressRows } = await supabase
    .from('user_sign_progress')
    .select('sign_id, mastery_status')
    .eq('user_id', user.id)

  const learningSignIds = (progressRows ?? [])
    .filter((r) => r.mastery_status === 'learning')
    .map((r) => r.sign_id)
    .filter((id): id is string => id !== null && !newSignIds.includes(id))

  const masteredSignIds = (progressRows ?? [])
    .filter((r) => r.mastery_status === 'mastered')
    .map((r) => r.sign_id)
    .filter((id): id is string => id !== null && !newSignIds.includes(id))

  // If there are no signs in any bucket (first-ever session), fall back to all active signs
  const hasHistory = learningSignIds.length > 0 || masteredSignIds.length > 0 || newSignIds.length > 0
  if (!hasHistory) {
    const { data: allSigns } = await supabase
      .from('signs')
      .select('id')
      .eq('is_active', true)
      .limit(20)
    newSignIds = (allSigns ?? []).map((s) => s.id)
  }

  // --- Bucket composition ---
  // post_lesson: 60% new, 30% learning, 10% mastered
  // standalone: 0% new (or all from learning+mastered), 70% learning, 30% mastered
  let selectedProblems: Array<{ sign_id: string; bucket: string }> = []

  if (session_type === 'post_lesson') {
    const nNew = Math.round(totalProblems * 0.6)
    const nReview = Math.round(totalProblems * 0.3)
    const nMastered = totalProblems - nNew - nReview

    const chosenNew = pickRandom(newSignIds, nNew)
    const chosenReview = pickRandom(learningSignIds, nReview)
    const chosenMastered = pickRandom(masteredSignIds, nMastered)

    // Redistribute any shortfall by pulling more from whichever buckets have signs
    const shortfall = totalProblems - chosenNew.length - chosenReview.length - chosenMastered.length
    const overflow = shortfall > 0
      ? pickRandom([...newSignIds, ...learningSignIds, ...masteredSignIds].filter(
          (id) => !chosenNew.includes(id) && !chosenReview.includes(id) && !chosenMastered.includes(id)
        ), shortfall)
      : []

    selectedProblems = [
      ...chosenNew.map((id) => ({ sign_id: id, bucket: 'new' })),
      ...chosenReview.map((id) => ({ sign_id: id, bucket: 'review' })),
      ...chosenMastered.map((id) => ({ sign_id: id, bucket: 'mastered' })),
      ...overflow.map((id) => ({ sign_id: id, bucket: 'new' })),
    ]
  } else {
    // Standalone: pull from learning (70%) and mastered (30%)
    const allAvailable = [...learningSignIds.map((id) => ({ id, bucket: 'review' as string })), ...masteredSignIds.map((id) => ({ id, bucket: 'mastered' as string }))]
    if (allAvailable.length === 0 && newSignIds.length > 0) {
      // First-ever standalone — use the new signs we found above
      selectedProblems = pickRandom(newSignIds, totalProblems).map((id) => ({ sign_id: id, bucket: 'new' }))
    } else {
      const nReview = Math.round(totalProblems * 0.7)
      const nMastered = totalProblems - nReview
      const chosenReview = pickRandom(learningSignIds, nReview)
      const chosenMastered = pickRandom(masteredSignIds, nMastered)
      const shortfall = totalProblems - chosenReview.length - chosenMastered.length
      const remaining = allAvailable.filter(
        (s) => !chosenReview.includes(s.id) && !chosenMastered.includes(s.id)
      )
      const overflow = shortfall > 0 ? pickRandom(remaining.map((r) => r.id), shortfall) : []

      selectedProblems = [
        ...chosenReview.map((id) => ({ sign_id: id, bucket: 'review' })),
        ...chosenMastered.map((id) => ({ sign_id: id, bucket: 'mastered' })),
        ...overflow.map((id) => ({ sign_id: id, bucket: 'review' })),
      ]
    }
  }

  // Shuffle so New/Review/Mastered aren't always grouped together
  selectedProblems = selectedProblems.sort(() => Math.random() - 0.5)

  // Fetch sign details for the selected sign IDs
  const allSelectedSignIds = [...new Set(selectedProblems.map((p) => p.sign_id))]
  const { data: signRows } = await supabase
    .from('signs')
    .select('id, slug, display_text, sign_type, video_path')
    .in('id', allSelectedSignIds)

  const signMap = new Map((signRows ?? []).map((s) => [s.id, s]))

  // Create the practice_session row
  const { data: session, error: sessionError } = await supabase
    .from('practice_sessions')
    .insert({
      user_id: user.id,
      user_lesson_id: user_lesson_id ?? null,
      session_type,
      total_problems: selectedProblems.length,
      correct_count: 0,
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (sessionError || !session) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create practice session' })
  }

  // Create practice_problems rows
  const problemInserts = selectedProblems.map((p) => {
    const sign = signMap.get(p.sign_id)
    const problemType = pickProblemType(learningStage)
    return {
      session_id: session.id,
      sign_id: p.sign_id,
      problem_type: problemType,
      knowledge_bucket: p.bucket,
      prompt_text: sign?.display_text ?? null,
      // video_path only matters for watch_and_type problems
      video_path: problemType === 'watch_and_type' ? (sign?.video_path ?? null) : null,
    }
  })

  const { data: problems, error: problemsError } = await supabase
    .from('practice_problems')
    .insert(problemInserts)
    .select()

  if (problemsError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create practice problems' })
  }

  // Attach signed video URLs for any watch_and_type problems
  const problemsWithUrls = await Promise.all(
    (problems ?? []).map(async (prob) => {
      let videoUrl: string | null = null
      if (prob.problem_type === 'watch_and_type' && prob.video_path) {
        const { data: urlData } = await supabase.storage
          .from('sign-videos')
          .createSignedUrl(prob.video_path, 3600)
        videoUrl = urlData?.signedUrl ?? null
      }
      const sign = signMap.get(prob.sign_id!)
      return { ...prob, videoUrl, sign: sign ?? null }
    })
  )

  return { sessionId: session.id, session: { ...session, problems: problemsWithUrls } }
})
