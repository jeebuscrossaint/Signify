import { useSupabaseAdmin } from './supabase'

export async function requireUser(event: any) {
  const authHeader = getHeader(event, 'Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, message: 'Missing or invalid authorization header' })
  }

  const token = authHeader.replace('Bearer ', '')
  const supabase = useSupabaseAdmin()

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    throw createError({ statusCode: 401, message: 'Invalid or expired token' })
  }

  return user
}