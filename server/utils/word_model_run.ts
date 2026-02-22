import { createError } from 'h3'

// Word model inference — not yet implemented.
// This will follow the same pattern as letter_model_run.ts once the word model is trained.

export async function runWordModel(
  _landmarks: Array<{ x: number; y: number }>
): Promise<{ predicted_word: string; confidence: number } | null> {
  throw createError({ statusCode: 501, statusMessage: 'Word model not yet implemented' })
}
