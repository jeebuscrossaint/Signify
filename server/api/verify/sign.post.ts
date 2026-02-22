import { defineEventHandler, readBody, createError } from 'h3'
import { requireUser } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'
import { runLetterModel } from '../../utils/letter_model_run'
import { updateSignProgress } from '../../utils/mastery'

// One-shot sign verification used during the lesson practice gate.
// The client sends MediaPipe landmarks for a single frame.
// Body: { sign_id: string, landmarks: Array<{x, y}>, problem_id?: string, session_id?: string }
// Returns: { is_correct, confidence, detected_sign }
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const supabase = useSupabaseAdmin()
  const body = await readBody(event)

  const { sign_id, landmarks, problem_id, session_id } = body ?? {}

  if (!sign_id) {
    throw createError({ statusCode: 400, statusMessage: 'sign_id is required' })
  }
  if (!landmarks || !Array.isArray(landmarks)) {
    throw createError({ statusCode: 400, statusMessage: 'landmarks array is required' })
  }

  // Fetch the sign's expected model label
  const { data: sign, error: signError } = await supabase
    .from('signs')
    .select('id, model_label, display_text')
    .eq('id', sign_id)
    .single()

  if (signError || !sign) {
    throw createError({ statusCode: 404, statusMessage: 'Sign not found' })
  }

  // Run inference through the letter model
  const result = await runLetterModel(landmarks)
  if (!result) {
    throw createError({ statusCode: 422, statusMessage: 'Model could not process landmarks — ensure hand is visible' })
  }

  const { predicted_letter, confidence } = result

  // Match against the sign's model_label, falling back to display_text
  const expected = (sign.model_label ?? sign.display_text ?? '').toUpperCase()
  const isCorrect = predicted_letter.toUpperCase() === expected && confidence >= 0.7

  // Update user_sign_progress when the user gets it right (exposure tracking for lesson gate)
  if (isCorrect) {
    await updateSignProgress(user.id, sign_id, true)
  }

  // If this verify is tied to a specific practice problem, update that row too
  if (problem_id && session_id) {
    await supabase
      .from('practice_problems')
      .update({
        user_answer: predicted_letter,
        model_confidence: confidence,
        is_correct: isCorrect,
        answered_at: new Date().toISOString(),
      })
      .eq('id', problem_id)
      .eq('session_id', session_id)
  }

  return {
    is_correct: isCorrect,
    confidence,
    detected_sign: predicted_letter,
  }
})
