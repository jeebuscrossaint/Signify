<script setup lang="ts">
const toast = useAppToast()

const page = ref(1)
const limit = 10

const { data, pending, refresh } = await useAsyncData(
  'lesson-history',
  () => $fetch<{
    lessons: Array<{
      id: string
      status: string | null
      score: number | null
      xp_earned: number | null
      started_at: string | null
      completed_at: string | null
      practice_done: boolean | null
      lesson: {
        id: string
        title: string | null
        lesson_type: string | null
        learning_stage: string | null
        lesson_signs: Array<{ signs: { display_text: string } }>
      } | null
    }>
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }>(`/api/lessons/history?page=${page.value}&limit=${limit}`),
  { watch: [page] }
)

const lessons = computed(() => data.value?.lessons ?? [])
const pagination = computed(() => data.value?.pagination)

const formatDate = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const scoreLabel = (score: number | null) =>
  score !== null ? `${Math.round(score * 100)}%` : '—'

const statusColor = (status: string | null) => {
  if (status === 'completed') return 'text-emerald-600 bg-emerald-50 border-emerald-100'
  return 'text-amber-600 bg-amber-50 border-amber-100'
}

const signsPreview = (lesson: typeof lessons.value[0]['lesson']) => {
  if (!lesson?.lesson_signs?.length) return ''
  return lesson.lesson_signs
    .slice(0, 6)
    .map((ls) => ls.signs.display_text)
    .join(', ')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <Nav />

    <main class="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold text-gray-900">Lesson history</h1>
        <span v-if="pagination" class="text-sm text-gray-400">{{ pagination.total }} total</span>
      </div>

      <!-- Loading skeleton -->
      <div v-if="pending" class="flex flex-col gap-3">
        <div v-for="i in 5" :key="i" class="bg-white rounded-2xl border border-gray-100 h-20 animate-pulse" />
      </div>

      <!-- Lesson list -->
      <div v-else-if="lessons.length > 0" class="flex flex-col gap-3">
        <NuxtLink
          v-for="lesson in lessons"
          :key="lesson.id"
          :to="`/lesson/${lesson.id}`"
          class="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between hover:border-violet-200 transition-colors group"
        >
          <div class="flex flex-col gap-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-sm font-semibold text-gray-900 group-hover:text-violet-700 transition-colors">
                {{ lesson.lesson?.title ?? 'Lesson' }}
              </p>
              <span
                class="text-xs font-medium border rounded-full px-2 py-0.5"
                :class="statusColor(lesson.status)"
              >
                {{ lesson.status === 'completed' ? 'Done' : 'In progress' }}
              </span>
            </div>
            <p v-if="signsPreview(lesson.lesson)" class="text-xs text-gray-400 truncate">
              {{ signsPreview(lesson.lesson) }}
            </p>
            <p class="text-xs text-gray-400">
              {{ formatDate(lesson.completed_at ?? lesson.started_at) }}
            </p>
          </div>

          <div class="flex items-center gap-4 shrink-0 ml-4">
            <div v-if="lesson.status === 'completed'" class="text-right">
              <p class="text-sm font-bold text-gray-800">{{ scoreLabel(lesson.score) }}</p>
              <p v-if="lesson.xp_earned" class="text-xs text-violet-500">+{{ lesson.xp_earned }} XP</p>
            </div>
            <svg class="w-4 h-4 text-gray-300 group-hover:text-violet-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </NuxtLink>
      </div>

      <!-- Empty state -->
      <div v-else class="text-center py-12">
        <p class="text-gray-400 text-sm">No lessons yet.</p>
        <NuxtLink to="/dashboard" class="inline-block mt-3 text-sm text-violet-600 hover:underline">
          Start your first lesson
        </NuxtLink>
      </div>

      <!-- Pagination -->
      <div v-if="pagination && pagination.totalPages > 1" class="flex items-center justify-center gap-2">
        <button
          class="px-4 py-2 text-sm font-medium bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40 rounded-xl transition-colors"
          :disabled="page <= 1"
          @click="page--"
        >
          Previous
        </button>
        <span class="text-sm text-gray-500">{{ page }} / {{ pagination.totalPages }}</span>
        <button
          class="px-4 py-2 text-sm font-medium bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40 rounded-xl transition-colors"
          :disabled="page >= pagination.totalPages"
          @click="page++"
        >
          Next
        </button>
      </div>

    </main>
  </div>
</template>
