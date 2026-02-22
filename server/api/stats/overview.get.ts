import { requireUser } from '~~/server/utils/auth'
import { useSupabaseAdmin } from '~~/server/utils/supabase'

// Returns a summary of the user's progress for the dashboard:
// XP, level, streak, sign counts, lesson count, and learning stage
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const supabase = useSupabaseAdmin()

  // Run all queries in parallel
  const [profileResult, streakResult, progressResult, lessonCountResult] = await Promise.all([
    supabase.from('users').select('xp, level, learning_stage, display_name').eq('id', user.id).single(),
    supabase.from('streaks').select('current_streak, longest_streak, last_activity').eq('user_id', user.id).single(),
    supabase.from('user_sign_progress').select('mastery_status').eq('user_id', user.id),
    supabase.from('user_lessons').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'completed'),
  ])

  const profile = profileResult.data
  const streak = streakResult.data
  const progress = progressResult.data ?? []
  const lessonCount = lessonCountResult.count ?? 0

  const totalSignsSeen = progress.length
  const masteredCount = progress.filter((p) => p.mastery_status === 'mastered').length
  const learningCount = progress.filter((p) => p.mastery_status === 'learning').length

  return {
    displayName: profile?.display_name ?? null,
    xp: profile?.xp ?? 0,
    level: profile?.level ?? 1,
    learningStage: profile?.learning_stage ?? 'letters',
    streak: {
      current: streak?.current_streak ?? 0,
      longest: streak?.longest_streak ?? 0,
      lastActivity: streak?.last_activity ?? null,
    },
    signs: {
      total_seen: totalSignsSeen,
      mastered: masteredCount,
      learning: learningCount,
    },
    lessonsCompleted: lessonCount,
  }
})
