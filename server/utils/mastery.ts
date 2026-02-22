import { useSupabaseAdmin } from './supabase'
import { createError } from 'h3'

type MasteryStatus = 'new' | 'learning' | 'mastered'

// Computes mastery status from the score and times_seen values.
function computeMasteryStatus(masteryScore: number, timesSeen: number): MasteryStatus {
  if (timesSeen === 0) return 'new'
  if (masteryScore >= 0.8 && timesSeen >= 5) return 'mastered'
  return 'learning'
}

// Upserts a user_sign_progress row after a practice answer.
// Returns whether this answer caused the sign to become mastered for the first time.
export async function updateSignProgress(
  userId: string,
  signId: string,
  isCorrect: boolean
): Promise<{ firstTimeMastered: boolean }> {
  const supabase = useSupabaseAdmin()

  // Fetch existing progress row
  const { data: existing } = await supabase
    .from('user_sign_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('sign_id', signId)
    .single()

  const prevStatus = existing?.mastery_status ?? 'new'
  const timesSeen = (existing?.times_seen ?? 0) + 1
  const timesCorrect = (existing?.times_correct ?? 0) + (isCorrect ? 1 : 0)
  const timesIncorrect = (existing?.times_incorrect ?? 0) + (isCorrect ? 0 : 1)

  // Score = correct / total attempts, avoid divide-by-zero
  const total = timesCorrect + timesIncorrect
  const masteryScore = total > 0 ? timesCorrect / total : 0
  const newStatus = computeMasteryStatus(masteryScore, timesSeen)
  const firstTimeMastered = prevStatus !== 'mastered' && newStatus === 'mastered'

  await supabase.from('user_sign_progress').upsert(
    {
      user_id: userId,
      sign_id: signId,
      times_seen: timesSeen,
      times_correct: timesCorrect,
      times_incorrect: timesIncorrect,
      mastery_score: masteryScore,
      mastery_status: newStatus,
      last_practiced: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,sign_id' }
  )

  return { firstTimeMastered }
}

// Checks if the user has mastered all available letter signs,
// used to decide whether to advance from the "letters" stage to "words".
export async function checkStageAdvancement(userId: string): Promise<string | null> {
  const supabase = useSupabaseAdmin()

  const { data: user } = await supabase
    .from('users')
    .select('learning_stage')
    .eq('id', userId)
    .single()

  if (!user || user.learning_stage !== 'letters') return null

  // Count total active letter signs and how many the user has mastered
  const { count: totalLetters } = await supabase
    .from('signs')
    .select('id', { count: 'exact', head: true })
    .eq('sign_type', 'letter')
    .eq('is_active', true)

  const { count: masteredLetters } = await supabase
    .from('user_sign_progress')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('mastery_status', 'mastered')
    .in(
      'sign_id',
      (await supabase.from('signs').select('id').eq('sign_type', 'letter').eq('is_active', true)).data?.map(
        (s: { id: string }) => s.id
      ) ?? []
    )

  // Advance to "words" when at least 80% of letters are mastered
  if (totalLetters && masteredLetters && masteredLetters / totalLetters >= 0.8) {
    await supabase
      .from('users')
      .update({ learning_stage: 'words', updated_at: new Date().toISOString() })
      .eq('id', userId)
    return 'words'
  }

  return null
}
