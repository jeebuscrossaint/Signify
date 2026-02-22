import { requireUser } from '~~/server/utils/auth'
import { useSupabaseAdmin } from '~~/server/utils/supabase'
import { updateSignProgress } from '~~/server/utils/mastery'
import { awardXP, XP } from '~~/server/utils/xp'
import { runLetterModel } from '~~/server/utils/letter_model_run'

// Handles an answer submission for a single practice problem.
// - watch_and_type: body has { typed_answer: string }
// - sign_to_camera: body has { landmarks: Array<{x,y}> }
// Returns { is_correct, correct_answer, confidence? }
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const supabase = useSupabaseAdmin()
  const sessionId = getRouterParam(event, 'sessionId')
  const problemId = getRouterParam(event, 'problemId')
  const body = await readBody(event)

  if (!sessionId || !problemId) {
    throw createError({ statusCode: 400, statusMessage: 'sessionId and problemId are required' })
  }

  // Verify the session belongs to this user
  const { data: session } = await supabase
    .from('practice_sessions')
    .select('id, user_id, status')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Session not found' })
  }

  if (session.status === 'completed') {
    throw createError({ statusCode: 409, statusMessage: 'Session already completed' })
  }

  // Fetch the problem with its sign
  const { data: problem } = await supabase
    .from('practice_problems')
    .select('*, signs(id, display_text, model_label, ai_mnemonic)')
    .eq('id', problemId)
    .eq('session_id', sessionId)
    .single()

  if (!problem) {
    throw createError({ statusCode: 404, statusMessage: 'Problem not found' })
  }

  const sign = (problem.signs as any)
  let isCorrect = false
  let confidence: number | null = null
  let detectedLabel: string | null = null
  let userAnswer: string | null = null

  if (problem.problem_type === 'watch_and_type') {
    // Type the word — simple case-insensitive string compare
    const typed = String(body?.typed_answer ?? '').trim().toLowerCase()
    userAnswer = typed
    isCorrect = typed === sign?.display_text?.toLowerCase()

  } else if (problem.problem_type === 'sign_to_camera' || problem.problem_type === 'sentence_sign') {
    // Landmarks from the MediaPipe client
    const landmarks: Array<{ x: number; y: number }> = body?.landmarks
    if (!landmarks || !Array.isArray(landmarks)) {
      throw createError({ statusCode: 400, statusMessage: 'landmarks array is required for sign_to_camera problems' })
    }

    const result = await runLetterModel(landmarks)
    if (!result) {
      throw createError({ statusCode: 422, statusMessage: 'Model could not process landmarks — ensure hand is visible' })
    }

    detectedLabel = result.predicted_letter
    confidence = result.confidence
    userAnswer = result.predicted_letter

    // Compare model output to the sign's model_label (or fall back to display_text)
    const expected = (sign?.model_label ?? sign?.display_text ?? '').toUpperCase()
    isCorrect = result.predicted_letter.toUpperCase() === expected && confidence >= 0.7
  } else {
    throw createError({ statusCode: 400, statusMessage: `Unknown problem type: ${problem.problem_type}` })
  }

  // Update the problem row
  const newAttemptCount = (problem.attempt_count ?? 1)
  await supabase
    .from('practice_problems')
    .update({
      user_answer: userAnswer,
      model_confidence: confidence,
      is_correct: isCorrect,
      attempt_count: newAttemptCount,
      answered_at: new Date().toISOString(),
    })
    .eq('id', problemId)

  // Update user_sign_progress for this sign
  const { firstTimeMastered } = await updateSignProgress(user.id, problem.sign_id!, isCorrect)

  // Award first-mastery bonus XP if applicable
  if (firstTimeMastered) {
    await awardXP(user.id, XP.FIRST_SIGN_MASTERED)
  }

  // If correct, increment the session's correct_count
  if (isCorrect) {
    const { data: currentSession } = await supabase
      .from('practice_sessions')
      .select('correct_count')
      .eq('id', sessionId)
      .single()
    if (currentSession) {
      await supabase
        .from('practice_sessions')
        .update({ correct_count: (currentSession.correct_count ?? 0) + 1 })
        .eq('id', sessionId)
    }
  }

  return {
    is_correct: isCorrect,
    correct_answer: sign?.display_text ?? null,
    confidence,
    detected_sign: detectedLabel,
    first_time_mastered: firstTimeMastered,
    hint: !isCorrect ? (sign?.ai_mnemonic ?? null) : null,
  }
})
