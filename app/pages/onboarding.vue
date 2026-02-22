<script setup lang="ts">
const toast = useAppToast()
const { profile, loadFromCache } = useUserProfile()

onMounted(() => loadFromCache())

const displayName = computed(() => profile.value?.displayName ?? 'there')

const loading = ref(false)

// Mark onboarding complete, then generate the first lesson and navigate into it
const beginFirstLesson = async () => {
  loading.value = true
  try {
    // Mark user as having completed onboarding
    await $fetch('/api/user/onboarding-complete', { method: 'POST' })
    // Generate the first AI lesson
    const data = await $fetch<{ userLessonId: string }>('/api/lessons/generate', { method: 'POST' })
    await navigateTo(`/lesson/${data.userLessonId}`)
  } catch (err: any) {
    toast.error(err?.data?.statusMessage ?? 'Something went wrong. Please try again.')
    loading.value = false
  }
}

// Points shown in the "what you will learn" section
const highlights = [
  { label: 'Signs', detail: 'Letters A–Z and common words' },
  { label: 'Practice', detail: 'Camera-based sign recognition' },
  { label: 'Progress', detail: 'Track mastery and streaks' },
]
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
    <div class="w-full max-w-md flex flex-col gap-8">

      <!-- Header -->
      <div class="text-center">
        <p class="text-sm font-semibold text-violet-500 uppercase tracking-widest mb-2">Welcome to</p>
        <h1 class="text-4xl font-bold text-violet-600">Signify</h1>
        <p class="text-gray-500 mt-2">Hi, {{ displayName }}. Let's start learning American Sign Language.</p>
      </div>

      <!-- What you get -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        <div
          v-for="item in highlights"
          :key="item.label"
          class="flex items-center gap-4 px-5 py-4"
        >
          <div class="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
          <div>
            <p class="text-sm font-semibold text-gray-800">{{ item.label }}</p>
            <p class="text-xs text-gray-500">{{ item.detail }}</p>
          </div>
        </div>
      </div>

      <!-- How it works note -->
      <p class="text-xs text-center text-gray-400">
        Each lesson is personalized using AI and adapts as you improve.
        Camera access is only used during sign practice.
      </p>

      <!-- CTA -->
      <button
        class="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold text-base rounded-2xl px-6 py-4 transition-colors flex items-center justify-center gap-2"
        :disabled="loading"
        @click="beginFirstLesson"
      >
        <svg v-if="loading" class="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        {{ loading ? 'Generating your first lesson...' : 'Start Learning' }}
      </button>

    </div>
  </div>
</template>
