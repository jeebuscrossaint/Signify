<script setup lang="ts">
const route = useRoute()
const toast = useAppToast()
const userLessonId = route.params.id as string

// Fetch the lesson — sign data + video URLs are embedded in the response
const { data, error } = await useAsyncData('lesson-' + userLessonId, () =>
  $fetch<{
    id: string
    status: string
    lesson: {
      id: string
      title: string | null
      intro_text: string | null
      lesson_type: string | null
      lesson_signs: Array<{
        id: string
        order_index: number | null
        is_new: boolean | null
        signs: {
          id: string
          slug: string
          display_text: string
          sign_type: string | null
          category: string | null
          ai_description: string | null
          ai_mnemonic: string | null
          ai_fun_fact: string | null
          videoUrl: string | null
        }
      }>
    }
  }>(`/api/lessons/${userLessonId}`)
)

if (error.value) {
  toast.error('Lesson not found')
  await navigateTo('/dashboard')
}

// Sort signs by order_index
const orderedSigns = computed(() => {
  const raw = data.value?.lesson?.lesson_signs ?? []
  return [...raw].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
})

const lessonTitle = computed(() => data.value?.lesson?.title ?? 'Lesson')
const introText = computed(() => data.value?.lesson?.intro_text ?? null)

// Step 0 = intro screen; 1..N = sign steps
const currentStep = ref(0)
const totalSteps = computed(() => orderedSigns.value.length)

// The current sign (null when on intro step)
const currentSign = computed(() =>
  currentStep.value > 0 ? orderedSigns.value[currentStep.value - 1]?.signs ?? null : null
)
const currentLessonSign = computed(() =>
  currentStep.value > 0 ? orderedSigns.value[currentStep.value - 1] ?? null : null
)

const isLastStep = computed(() => currentStep.value === totalSteps.value)
const isIntroStep = computed(() => currentStep.value === 0)

const goNext = () => {
  if (currentStep.value < totalSteps.value) currentStep.value++
}
const goBack = () => {
  if (currentStep.value > 0) currentStep.value--
}

// Complete the lesson and start practice
const completing = ref(false)

const completeLessonAndPractice = async () => {
  completing.value = true
  try {
    // Mark lesson complete
    await $fetch(`/api/lessons/${userLessonId}/complete`, { method: 'POST' })

    // Start post-lesson practice
    const practiceData = await $fetch<{ sessionId: string }>('/api/practice/start', {
      method: 'POST',
      body: { session_type: 'post_lesson', user_lesson_id: userLessonId },
    })
    await navigateTo(`/practice/${practiceData.sessionId}`)
  } catch (err: any) {
    toast.error(err?.data?.statusMessage ?? 'Could not start practice. Try again.')
    completing.value = false
  }
}

</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <Nav />

    <main class="max-w-2xl mx-auto px-4 sm:px-6 py-8">

      <!-- Progress bar -->
      <div v-if="totalSteps > 0" class="mb-6">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-gray-400">
            {{ isIntroStep ? 'Intro' : `Sign ${currentStep} of ${totalSteps}` }}
          </span>
          <span class="text-xs font-medium text-violet-500">{{ lessonTitle }}</span>
        </div>
        <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            class="h-full bg-violet-500 rounded-full transition-all duration-300"
            :style="{ width: ((currentStep / totalSteps) * 100) + '%' }"
          />
        </div>
      </div>

      <!-- Intro step -->
      <div v-if="isIntroStep" class="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col gap-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-2">{{ lessonTitle }}</h1>
          <p v-if="introText" class="text-gray-600 leading-relaxed">{{ introText }}</p>
        </div>

        <!-- Sign preview chips -->
        <div class="flex flex-wrap gap-2">
          <span
            v-for="ls in orderedSigns"
            :key="ls.id"
            class="text-base font-bold bg-violet-50 border border-violet-100 text-violet-700 rounded-xl px-3 py-1.5"
          >
            {{ ls.signs.display_text }}
          </span>
        </div>

        <p class="text-sm text-gray-400">
          {{ totalSteps }} sign{{ totalSteps === 1 ? '' : 's' }} in this lesson.
          Take your time with each one.
        </p>

        <button
          class="bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl px-6 py-3 transition-colors"
          @click="goNext"
        >
          Start lesson
        </button>
      </div>

      <!-- Sign step -->
      <div v-else-if="currentSign" class="flex flex-col gap-4">

        <!-- Sign card -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          <!-- Sign header -->
          <div class="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
            <div>
              <p class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                {{ currentSign.category ?? currentSign.sign_type ?? 'Sign' }}
              </p>
              <h2 class="text-5xl font-black text-gray-900 tracking-tight">
                {{ currentSign.display_text }}
              </h2>
              <span
                v-if="currentLessonSign?.is_new"
                class="mt-2 inline-block text-xs font-medium bg-violet-50 text-violet-600 border border-violet-100 rounded-full px-2.5 py-0.5"
              >
                New
              </span>
            </div>
          </div>

          <!-- Video (when available) -->
          <div v-if="currentSign.videoUrl" class="w-full bg-gray-100">
            <video
              :key="currentSign.videoUrl"
              class="w-full max-h-72 object-contain"
              :src="currentSign.videoUrl"
              autoplay
              loop
              muted
              playsinline
              controls
            />
          </div>

          <!-- No video fallback: show large letter prominently -->
          <div v-else class="w-full h-48 bg-linear-to-br from-violet-50 to-indigo-50 flex items-center justify-center">
            <span class="text-8xl font-black text-violet-200 select-none">{{ currentSign.display_text }}</span>
          </div>

          <!-- AI content -->
          <div class="px-6 py-5 flex flex-col gap-4">
            <p v-if="currentSign.ai_description" class="text-sm text-gray-600 leading-relaxed">
              {{ currentSign.ai_description }}
            </p>

            <!-- Memory tip -->
            <div v-if="currentSign.ai_mnemonic" class="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <p class="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Memory tip</p>
              <p class="text-sm text-amber-800">{{ currentSign.ai_mnemonic }}</p>
            </div>

            <!-- Fun fact -->
            <div v-if="currentSign.ai_fun_fact" class="bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
              <p class="text-xs font-semibold text-sky-600 uppercase tracking-wide mb-1">Fun fact</p>
              <p class="text-sm text-sky-800">{{ currentSign.ai_fun_fact }}</p>
            </div>
          </div>
        </div>

        <!-- Navigation -->
        <div class="flex gap-3">
          <button
            v-if="currentStep > 0"
            class="bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium rounded-xl px-5 py-3 transition-colors"
            @click="goBack"
          >
            Back
          </button>

          <!-- Complete lesson (last step) -->
          <button
            v-if="isLastStep"
            class="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold rounded-xl px-6 py-3 transition-colors flex items-center justify-center gap-2"
            :disabled="completing"
            @click="completeLessonAndPractice"
          >
            <svg v-if="completing" class="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            {{ completing ? 'Starting practice...' : 'Complete and practice' }}
          </button>

          <!-- Next sign -->
          <button
            v-else
            class="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl px-6 py-3 transition-colors"
            @click="goNext"
          >
            Next
          </button>
        </div>
      </div>

    </main>
  </div>
</template>
