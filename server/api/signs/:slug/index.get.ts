import { requireUser } from '~~/server/utils/auth'
import { useSupabaseAdmin } from '~~/server/utils/supabase'

// Returns a single sign with all its AI-generated content
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const supabase = useSupabaseAdmin()
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'slug is required' })
  }

  const { data: sign, error } = await supabase
    .from('signs')
    .select('id, slug, display_text, sign_type, category, difficulty, ai_description, ai_mnemonic, ai_fun_fact, ai_generated_at, is_active')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error || !sign) {
    throw createError({ statusCode: 404, statusMessage: 'Sign not found' })
  }

  return { sign }
})
