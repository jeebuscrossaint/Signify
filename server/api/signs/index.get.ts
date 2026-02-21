import { useSupabaseAdmin } from '~/../server/utils/supabase'

export default defineEventHandler(async () => {
  const supabase = useSupabaseAdmin()

  const { data, error } = await supabase
    .from('signs')
    .select('*')
    .eq('is_active', true)
    .order('difficulty', { ascending: true })

  if (error) throw createError({ statusCode: 500, message: error.message })

  return { signs: data }
})