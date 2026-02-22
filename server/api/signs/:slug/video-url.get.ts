import { requireUser } from '~~/server/utils/auth'
import { useSupabaseAdmin } from '~~/server/utils/supabase'

// Returns a short-lived signed URL for a sign's demo video from Supabase Storage.
// The URL expires after 1 hour.
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const supabase = useSupabaseAdmin()
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'slug is required' })
  }

  const { data: sign, error } = await supabase
    .from('signs')
    .select('video_path')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error || !sign) {
    throw createError({ statusCode: 404, statusMessage: 'Sign not found' })
  }

  if (!sign.video_path) {
    throw createError({ statusCode: 404, statusMessage: 'No video available for this sign' })
  }

  const { data: urlData, error: urlError } = await supabase.storage
    .from('sign-videos')
    .createSignedUrl(sign.video_path, 3600)

  if (urlError || !urlData) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to generate video URL' })
  }

  return { url: urlData.signedUrl }
})
