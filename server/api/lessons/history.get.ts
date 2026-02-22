import { requireUser } from '~~/server/utils/auth'
import { useSupabaseAdmin } from '~~/server/utils/supabase'

// Returns paginated lesson history for the authenticated user.
// Query params: page (default 1), limit (default 10)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const supabase = useSupabaseAdmin()

  const query = getQuery(event)
  const page = Math.max(1, Number(query.page ?? 1))
  const limit = Math.min(50, Math.max(1, Number(query.limit ?? 10)))
  const offset = (page - 1) * limit

  const { data, error, count } = await supabase
    .from('user_lessons')
    .select(
      `
      id,
      status,
      score,
      xp_earned,
      started_at,
      completed_at,
      practice_done,
      lesson:lesson_id (
        id,
        title,
        lesson_type,
        theme,
        learning_stage,
        lesson_signs ( sign_id, order_index, signs ( slug, display_text, sign_type ) )
      )
    `,
      { count: 'exact' }
    )
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to fetch lesson history' })
  }

  return {
    lessons: data ?? [],
    pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
  }
})
