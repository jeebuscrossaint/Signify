import { requireUser } from '~~/server/utils/auth'
import { useSupabaseAdmin } from '~~/server/utils/supabase'

// Returns daily activity counts for the past 90 days — used for calendar heatmap.
// Each entry is { date: 'YYYY-MM-DD', count: number }.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const supabase = useSupabaseAdmin()

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch completed lessons and practice sessions within the window
  const [lessonsResult, sessionsResult] = await Promise.all([
    supabase
      .from('user_lessons')
      .select('completed_at')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('completed_at', since),
    supabase
      .from('practice_sessions')
      .select('completed_at')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('completed_at', since),
  ])

  // Group all activity timestamps by date and count them
  const activityMap = new Map<string, number>()

  const addDate = (ts: string | null) => {
    if (!ts) return
    const date = ts.slice(0, 10) // YYYY-MM-DD
    activityMap.set(date, (activityMap.get(date) ?? 0) + 1)
  }

  ;(lessonsResult.data ?? []).forEach((r) => addDate(r.completed_at))
  ;(sessionsResult.data ?? []).forEach((r) => addDate(r.completed_at))

  const activity = Array.from(activityMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return { activity }
})
