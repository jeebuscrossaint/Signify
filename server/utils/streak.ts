import { useSupabaseAdmin } from './supabase'
import { XP, awardXP } from './xp'

// Checks and updates a user's streak after activity.
// - If last activity was today: no-op
// - If last activity was yesterday: increment streak
// - If older (or never): reset streak to 1
// Awards bonus XP if the streak is maintained.
// Returns the updated streak row.
export async function updateStreak(userId: string) {
  const supabase = useSupabaseAdmin()

  const { data: streak, error } = await supabase
    .from('streaks')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !streak) {
    return null
  }

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const lastActivity = streak.last_activity?.slice(0, 10)

  if (lastActivity === today) {
    // Already active today, nothing to do
    return streak
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const isConsecutive = lastActivity === yesterday

  const newStreak = isConsecutive ? (streak.current_streak ?? 0) + 1 : 1
  const newLongest = Math.max(streak.longest_streak ?? 0, newStreak)

  await supabase
    .from('streaks')
    .update({
      current_streak: newStreak,
      longest_streak: newLongest,
      last_activity: today,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  // Award streak bonus XP when streak is maintained (not when resetting)
  if (isConsecutive) {
    await awardXP(userId, XP.STREAK_MAINTAINED)
  }

  return { ...streak, current_streak: newStreak, longest_streak: newLongest, last_activity: today }
}
