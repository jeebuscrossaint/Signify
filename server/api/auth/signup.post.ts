import { useSupabaseAdmin } from "~~/server/utils/supabase"

export default defineEventHandler(async (event) => {
  const { email, password } = await readBody(event)

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }

  const supabase = useSupabaseAdmin()

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // auto-confirm so no email verification needed
  })

  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message })
  }

  return { user: data.user }
})
