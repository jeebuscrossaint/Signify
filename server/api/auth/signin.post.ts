import { useSupabaseAdmin } from "~~/server/utils/supabase"

export default defineEventHandler(async (event) => {
  const { email, password } = await readBody(event)

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }

  const supabase = useSupabaseAdmin()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message })
  }

  return { user: data.user, session: data.session }
})
