import { defineEventHandler, createError } from 'h3'
import { requireUser } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'
import { geminiGenerateLesson, geminiGenerateSignDetail } from '../../utils/gemini'

// How many signs to teach based on the user's current level
function signsToTeach(level: number): number {
  if (level >= 5) return 5
  if (level >= 3) return 4
  return 3
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const supabase = useSupabaseAdmin()

  // Fetch user profile
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('learning_stage, level, onboarding_complete')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    throw createError({ statusCode: 404, statusMessage: 'User profile not found' })
  }

  const learningStage = profile.learning_stage ?? 'letters'
  const userLevel = profile.level ?? 1
  const isFirstLesson = !profile.onboarding_complete

  // Fetch user's existing sign progress to know what's been introduced
  const { data: progressRows } = await supabase
    .from('user_sign_progress')
    .select('sign_id, mastery_status, times_seen')
    .eq('user_id', user.id)

  type ProgressRow = { sign_id: string; mastery_status: string | null; times_seen: number | null }
  const introducedSignIds = new Set(
    (progressRows ?? [] as ProgressRow[]).filter((r) => r.times_seen && r.times_seen > 0).map((r) => r.sign_id)
  )
  const learningSignIds = new Set(
    (progressRows ?? [] as ProgressRow[]).filter((r) => r.mastery_status === 'learning').map((r) => r.sign_id)
  )

  // Determine which sign_type to query based on learning stage
  const signTypeFilter = learningStage === 'letters' ? 'letter' : learningStage === 'words' ? 'word' : 'word'

  // Fetch available signs for this stage, excluding already-introduced ones
  const { data: allSigns } = await supabase
    .from('signs')
    .select('id, slug, display_text, category, difficulty, sign_type')
    .eq('sign_type', signTypeFilter)
    .eq('is_active', true)
    .order('difficulty', { ascending: true })

  type SignRow = { id: string; slug: string; display_text: string; category: string | null; difficulty: number | null; sign_type: string }
  const availableSigns = (allSigns ?? [] as SignRow[]).filter((s) => !introducedSignIds.has(s.id))

  if (availableSigns.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No new signs available for this learning stage' })
  }

  // Gather slug lists for the Gemini context
  const allSignsTyped = (allSigns ?? []) as SignRow[]
  const introducedSlugs = allSignsTyped.filter((s) => introducedSignIds.has(s.id)).map((s) => s.slug)
  const learningSlugs = allSignsTyped.filter((s) => learningSignIds.has(s.id)).map((s) => s.slug)
  const n = signsToTeach(userLevel)

  // Call Gemini to generate the lesson plan
  const geminiLesson = await geminiGenerateLesson({
    learning_stage: learningStage,
    user_level: userLevel,
    introduced_slugs: introducedSlugs,
    learning_slugs: learningSlugs,
    is_first_lesson: isFirstLesson,
    available_signs: availableSigns.map((s) => ({
      slug: s.slug,
      display_text: s.display_text,
      category: s.category,
      difficulty: s.difficulty,
    })),
    n,
  })

  // Validate that Gemini returned recognizable slugs
  type GeminiSignToTeach = { slug: string; [key: string]: unknown }
  const validSlugs = new Set(availableSigns.map((s) => s.slug))
  const teachSigns = ((geminiLesson.signs_to_teach ?? []) as GeminiSignToTeach[]).filter((s) => validSlugs.has(s.slug))

  if (teachSigns.length === 0) {
    throw createError({ statusCode: 502, statusMessage: 'Gemini returned no valid signs' })
  }

  // Fetch full sign rows for each chosen sign
  type FullSignRow = { id: string; slug: string; display_text: string; sign_type: string; category: string | null; difficulty: number | null; video_path: string | null; ai_description: string | null; ai_mnemonic: string | null; ai_fun_fact: string | null; ai_generated_at: string | null; model_label: string | null; [key: string]: unknown }
  const { data: chosenSignRows } = await supabase
    .from('signs')
    .select('*')
    .in('slug', teachSigns.map((s) => s.slug))

  const signMap = new Map((chosenSignRows ?? [] as FullSignRow[]).map((s) => [s.slug, s]))

  // For any sign missing AI content, call Gemini sign detail and write it back
  for (const teach of teachSigns) {
    const sign = signMap.get(teach.slug)
    if (!sign) continue
    if (!sign.ai_description) {
      try {
        const detail = await geminiGenerateSignDetail({
          display_text: sign.display_text,
          sign_type: sign.sign_type,
          category: sign.category,
        })
        await supabase
          .from('signs')
          .update({
            ai_description: detail.ai_description,
            ai_mnemonic: detail.ai_mnemonic,
            ai_fun_fact: detail.ai_fun_fact,
            ai_generated_at: new Date().toISOString(),
          })
          .eq('id', sign.id)
        // Merge into our local map so we return fresh data
        signMap.set(sign.slug, { ...sign, ...detail, ai_generated_at: new Date().toISOString() })
      } catch {
        // Non-fatal: leave AI fields null if Gemini fails for this sign
      }
    }
  }

  // Insert the lesson row
  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .insert({
      title: geminiLesson.title,
      intro_text: geminiLesson.intro_text,
      lesson_type: isFirstLesson ? 'alphabet_intro' : geminiLesson.lesson_type,
      theme: geminiLesson.theme ?? null,
      learning_stage: learningStage,
      gemini_prompt: null, // prompt text could be stored here for audit if needed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gemini_response: geminiLesson as any,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (lessonError || !lesson) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to save lesson' })
  }

  // Insert lesson_signs junction rows
  const lessonSignInserts = teachSigns.map((s, index) => ({
    lesson_id: lesson.id,
    sign_id: signMap.get(s.slug)!.id,
    order_index: index,
    is_new: true,
  }))
  await supabase.from('lesson_signs').insert(lessonSignInserts)

  // Create the user_lessons record
  const { data: userLesson, error: ulError } = await supabase
    .from('user_lessons')
    .insert({
      user_id: user.id,
      lesson_id: lesson.id,
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (ulError || !userLesson) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create user lesson record' })
  }

  // Generate signed video URLs for each sign (1 hour expiry)
  const signsWithUrls = await Promise.all(
    teachSigns.map(async (t) => {
      const sign = signMap.get(t.slug)!
      let videoUrl: string | null = null
      if (sign.video_path) {
        const { data: urlData } = await supabase.storage
          .from('sign-videos')
          .createSignedUrl(sign.video_path, 3600)
        videoUrl = urlData?.signedUrl ?? null
      }
      return { ...sign, videoUrl }
    })
  )

  // If this is the first lesson, flip onboarding_complete so future lessons are standard
  if (isFirstLesson) {
    await supabase
      .from('users')
      .update({ onboarding_complete: true, updated_at: new Date().toISOString() })
      .eq('id', user.id)
  }

  return {
    userLessonId: userLesson.id,
    lesson: {
      ...lesson,
      signs: signsWithUrls,
    },
  }
})
