import { useSupabaseAdmin } from "~~/server/utils/supabase"

export default defineEventHandler(async (event) => {
  const { email, password, display_name } = await readBody(event)

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }

  const supabase = useSupabaseAdmin()

  // Create the auth user
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message })
  }

  // Create the public profile row linked to the auth user
  await supabase.from('users').insert({
    id: data.user.id,
    display_name: display_name ?? email.split('@')[0],
    xp: 0,
    level: 1,
    onboarding_complete: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  // Create the streaks row
  await supabase.from('streaks').insert({
    user_id: data.user.id,
    current_streak: 0,
    longest_streak: 0,
    updated_at: new Date().toISOString(),
  })

  return { user: data.user }
})

