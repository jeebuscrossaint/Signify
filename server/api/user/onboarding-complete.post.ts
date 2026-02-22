import { defineEventHandler, createError } from 'h3'
import { requireUser } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'

// Marks onboarding as complete, sets learning stage to "letters",
// and ensures a streaks row exists for the user
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const supabase = useSupabaseAdmin()

  const { data: profile, error: updateError } = await supabase
    .from('users')
    .update({
      onboarding_complete: true,
      learning_stage: 'letters',
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
    .select()
    .single()

  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to complete onboarding' })
  }

  // Create streaks row if it doesn't exist yet
  await supabase.from('streaks').upsert(
    {
      user_id: user.id,
      current_streak: 0,
      longest_streak: 0,
      last_activity: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id', ignoreDuplicates: true }
  )

  return { profile }
})
