<script setup lang="ts">
const toast = useAppToast()
const { profile, refresh: refreshProfile, patch } = useUserProfile()

// Overview stats from the server
const { data: overview, refresh: refreshOverview } = await useAsyncData('dashboard-overview', () =>
  $fetch<{
    displayName: string | null
    xp: number
    level: number
    learningStage: string
    streak: { current: number; longest: number; lastActivity: string | null }
    signs: { total_seen: number; mastered: number; learning: number }
    lessonsCompleted: number
  }>('/api/stats/overview')
)

// Recent lessons for the "Continue" section
const { data: historyData } = await useAsyncData('dashboard-history', () =>
  $fetch<{
    lessons: Array<{
      id: string
      status: string
      score: number | null
      xp_earned: number | null
      completed_at: string | null
      started_at: string | null
      lesson: { title: string | null; lesson_type: string | null } | null
    }>
  }>('/api/lessons/history?limit=5')
)

const recentLessons = computed(() => historyData.value?.lessons ?? [])

// Sync overview data into the profile cache so nav shows fresh values
watchEffect(() => {
  if (overview.value) {
    patch({
      displayName: overview.value.displayName,
      xp: overview.value.xp,
      level: overview.value.level,
      learningStage: overview.value.learningStage,
    })
  }
})

// Greeting based on time of day
const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
})

const displayName = computed(() => overview.value?.displayName ?? 'there')

// Format XP progress toward next level
const xpForNextLevel = computed(() => {
  const level = overview.value?.level ?? 1
  return (level + 1) * (level + 1) * 100
})
const xpProgress = computed(() => {
  const xp = overview.value?.xp ?? 0
  const needed = xpForNextLevel.value
  const currentLevelXp = (overview.value?.level ?? 1) ** 2 * 100
  return Math.min(100, Math.round(((xp - currentLevelXp) / (needed - currentLevelXp)) * 100))
})

// Generate a new lesson
const generatingLesson = ref(false)

const startNewLesson = async () => {
  generatingLesson.value = true
  try {
    const data = await $fetch<{ userLessonId: string }>('/api/lessons/generate', { method: 'POST' })
    await navigateTo(`/lesson/${data.userLessonId}`)
  } catch (err: any) {
    toast.error(err?.data?.statusMessage ?? 'Could not generate a lesson right now')
  } finally {
    generatingLesson.value = false
  }
}

// Start a standalone practice session
const startingPractice = ref(false)

const startPractice = async () => {
  startingPractice.value = true
  try {
    const data = await $fetch<{ sessionId: string }>('/api/practice/start', {
      method: 'POST',
      body: { session_type: 'standalone' },
    })
    await navigateTo(`/practice/${data.sessionId}`)
  } catch (err: any) {
    toast.error(err?.data?.statusMessage ?? 'Could not start a practice session')
  } finally {
    startingPractice.value = false
  }
}

// Format a date string as a relative label like "Today", "Yesterday" or a date
const formatDate = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  const today = new Date()
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const scorePercent = (score: number | null) =>
  score !== null ? `${Math.round(score * 100)}%` : '—'

// Stage label formatting
const stageLabel = (stage: string) =>
  stage.charAt(0).toUpperCase() + stage.slice(1)
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <Nav />

    <main class="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">

      <!-- Greeting -->
      <section>
        <h1 class="text-2xl font-bold text-gray-900">
          {{ greeting }}, {{ displayName }}
        </h1>
        <p v-if="overview" class="text-sm text-gray-500 mt-1">
          Learning stage:
          <span class="font-medium text-violet-600 capitalize">{{ overview.learningStage }}</span>
        </p>
      </section>

      <!-- Stats row -->
      <section v-if="overview" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <!-- Level -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1">
          <p class="text-xs font-medium text-gray-400 uppercase tracking-wide">Level</p>
          <p class="text-3xl font-bold text-violet-600">{{ overview.level }}</p>
          <!-- XP progress bar -->
          <div class="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              class="h-full bg-violet-400 rounded-full transition-all"
              :style="{ width: xpProgress + '%' }"
            />
          </div>
          <p class="text-xs text-gray-400">{{ overview.xp }} XP</p>
        </div>

        <!-- Streak -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1">
          <p class="text-xs font-medium text-gray-400 uppercase tracking-wide">Streak</p>
          <p class="text-3xl font-bold text-orange-500">{{ overview.streak.current }}</p>
          <p class="text-xs text-gray-400">Best: {{ overview.streak.longest }}</p>
        </div>

        <!-- Signs mastered -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1">
          <p class="text-xs font-medium text-gray-400 uppercase tracking-wide">Mastered</p>
          <p class="text-3xl font-bold text-emerald-600">{{ overview.signs.mastered }}</p>
          <p class="text-xs text-gray-400">{{ overview.signs.total_seen }} seen</p>
        </div>

        <!-- Lessons completed -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1">
          <p class="text-xs font-medium text-gray-400 uppercase tracking-wide">Lessons</p>
          <p class="text-3xl font-bold text-gray-800">{{ overview.lessonsCompleted }}</p>
          <p class="text-xs text-gray-400">completed</p>
        </div>
      </section>

      <!-- Primary actions -->
      <section class="flex flex-col sm:flex-row gap-3">
        <!-- Start new lesson -->
        <button
          class="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold rounded-2xl px-6 py-4 text-center transition-colors flex items-center justify-center gap-2"
          :disabled="generatingLesson || startingPractice"
          @click="startNewLesson"
        >
          <svg v-if="generatingLesson" class="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span>{{ generatingLesson ? 'Generating lesson...' : 'Start New Lesson' }}</span>
        </button>

        <!-- Practice (only when user has seen signs) -->
        <button
          v-if="overview && (overview.signs.learning > 0 || overview.signs.mastered > 0)"
          class="flex-1 sm:flex-none bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-60 text-gray-700 font-semibold rounded-2xl px-6 py-4 transition-colors flex items-center justify-center gap-2"
          :disabled="startingPractice || generatingLesson"
          @click="startPractice"
        >
          <svg v-if="startingPractice" class="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          <span>{{ startingPractice ? 'Starting...' : 'Practice' }}</span>
        </button>

        <!-- Quick links -->
        <div class="flex gap-2">
          <NuxtLink
            to="/stats"
            class="bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium rounded-2xl px-4 py-4 transition-colors text-sm flex items-center gap-1.5"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Stats
          </NuxtLink>
          <NuxtLink
            to="/history"
            class="bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium rounded-2xl px-4 py-4 transition-colors text-sm flex items-center gap-1.5"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History
          </NuxtLink>
        </div>
      </section>

      <!-- Recent lessons -->
      <section v-if="recentLessons.length > 0">
        <h2 class="text-base font-semibold text-gray-700 mb-3">Recent lessons</h2>
        <div class="flex flex-col gap-2">
          <NuxtLink
            v-for="lesson in recentLessons"
            :key="lesson.id"
            :to="`/lesson/${lesson.id}`"
            class="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between hover:border-violet-200 transition-colors group"
          >
            <div class="flex flex-col gap-0.5">
              <p class="text-sm font-medium text-gray-900 group-hover:text-violet-700 transition-colors">
                {{ lesson.lesson?.title ?? 'Lesson' }}
              </p>
              <p class="text-xs text-gray-400">{{ formatDate(lesson.completed_at ?? lesson.started_at) }}</p>
            </div>
            <div class="flex items-center gap-3">
              <span
                v-if="lesson.status === 'completed'"
                class="text-sm font-semibold text-emerald-600"
              >
                {{ scorePercent(lesson.score) }}
              </span>
              <span
                v-else
                class="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5"
              >
                In progress
              </span>
              <svg class="w-4 h-4 text-gray-300 group-hover:text-violet-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </NuxtLink>
        </div>
        <NuxtLink to="/history" class="block text-center text-sm text-violet-600 hover:underline mt-3">
          View all history
        </NuxtLink>
      </section>

      <!-- Empty state for first-time users who somehow got here without finishing onboarding -->
      <section v-else-if="overview && overview.lessonsCompleted === 0">
        <div class="bg-violet-50 border border-violet-100 rounded-2xl p-6 text-center">
          <p class="text-sm text-violet-700 font-medium mb-1">Ready to start?</p>
          <p class="text-xs text-violet-500">Hit "Start New Lesson" above to begin your ASL journey.</p>
        </div>
      </section>

    </main>
  </div>
</template>
