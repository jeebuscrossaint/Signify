import { createError } from 'h3'
import { useSupabaseAdmin } from './supabase'

// XP values for every rewarded action
export const XP = {
  LESSON_COMPLETE_BASE: 50,
  PER_SIGN_TAUGHT: 10,
  PRACTICE_COMPLETE_BASE: 30,
  PER_CORRECT_ANSWER: 5,
  PERFECT_PRACTICE_BONUS: 20,
  STREAK_MAINTAINED: 10,
  FIRST_SIGN_MASTERED: 15,
}

// Level = floor(sqrt(xp / 100)), giving a satisfying early curve that slows at higher levels
function computeLevel(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(xp / 100)))
}

// Adds the given amount of XP to a user and recomputes their level.
// Returns the updated xp and level values.
export async function awardXP(userId: string, amount: number): Promise<{ xp: number; level: number }> {
  const supabase = useSupabaseAdmin()

  // Fetch current XP
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('xp')
    .eq('id', userId)
    .single()

  if (fetchError || !user) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to fetch user XP' })
  }

  const newXp = (user.xp ?? 0) + amount
  const newLevel = computeLevel(newXp)

  const { error: updateError } = await supabase
    .from('users')
    .update({ xp: newXp, level: newLevel, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update user XP' })
  }

  return { xp: newXp, level: newLevel }
}
