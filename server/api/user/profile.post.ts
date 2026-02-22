import { defineEventHandler, readBody, createError } from 'h3'
import { requireUser } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'

// Updates mutable user profile fields (currently: display_name)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)

  const { display_name } = body
  if (!display_name || typeof display_name !== 'string' || !display_name.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'display_name is required' })
  }

  const supabase = useSupabaseAdmin()

  const { data, error } = await supabase
    .from('users')
    .update({ display_name: display_name.trim(), updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select()
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update profile' })
  }

  return { profile: data }
})
