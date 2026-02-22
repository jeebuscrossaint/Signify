<script setup lang="ts">
const toast = useAppToast()

const [overviewResult, signsResult] = await Promise.all([
  useAsyncData('stats-overview', () => $fetch<{
    level: number
    xp: number
    learningStage: string
    streak: { current: number; longest: number; lastActivity: string | null }
    signs: { total_seen: number; mastered: number; learning: number }
    lessonsCompleted: number
  }>('/api/stats/overview')),
  useAsyncData('stats-signs', () => $fetch<{
    signs: Array<{
      id: string
      mastery_status: string | null
      mastery_score: number | null
      times_seen: number
      times_correct: number
      times_incorrect: number
      last_practiced: string | null
      signs: {
        id: string
        slug: string
        display_text: string
        sign_type: string | null
        category: string | null
        difficulty: string | null
      }
    }>
  }>('/api/stats/signs')),
])

const overview = computed(() => overviewResult.data.value)
const allSigns = computed(() => signsResult.data.value?.signs ?? [])

const mastered = computed(() =>
  allSigns.value.filter((s) => s.mastery_status === 'mastered')
)
const learning = computed(() =>
  allSigns.value.filter((s) => s.mastery_status === 'learning')
)
const unseen = computed(() =>
  allSigns.value.filter((s) => !s.mastery_status || s.mastery_status === 'new')
)

const xpProgress = computed(() => {
  if (!overview.value) return 0
  const level = overview.value.level
  const xp = overview.value.xp
  // Same formula as dashboard: level^2 * 100 per level threshold
  const currentLevelXp = level ** 2 * 100
  const nextLevelXp = (level + 1) ** 2 * 100
  const range = nextLevelXp - currentLevelXp
  if (range <= 0) return 100
  return Math.min(100, Math.max(0, ((xp - currentLevelXp) / range) * 100))
})

const accuracyLabel = (s: typeof allSigns.value[0]) => {
  const total = s.times_correct + s.times_incorrect
  if (total === 0) return null
  return `${Math.round((s.times_correct / total) * 100)}%`
}

const masteryBarWidth = (score: number | null) =>
  score !== null ? `${Math.round(score * 100)}%` : '0%'

const pending = computed(() => overviewResult.pending.value || signsResult.pending.value)
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <Nav />

    <main class="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">

      <h1 class="text-xl font-bold text-gray-900">Stats</h1>

      <!-- Loading state -->
      <div v-if="pending" class="flex flex-col gap-4">
        <div v-for="i in 3" :key="i" class="bg-white rounded-2xl border border-gray-100 h-20 animate-pulse" />
      </div>

      <template v-else>

        <!-- Overview stats -->
        <div v-if="overview" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <!-- Level + XP -->
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2 sm:col-span-2">
            <p class="text-xs text-gray-400 font-medium uppercase tracking-wide">Level</p>
            <div class="flex items-center justify-between">
              <p class="text-3xl font-black text-violet-600">{{ overview.level }}</p>
              <p class="text-xs text-gray-400">{{ overview.xp.toLocaleString() }} XP</p>
            </div>
            <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                class="h-full rounded-full bg-violet-500 transition-all duration-500"
                :style="{ width: xpProgress + '%' }"
              />
            </div>
            <p class="text-xs text-gray-400">{{ Math.round(xpProgress) }}% to level {{ overview.level + 1 }}</p>
          </div>

          <!-- Streak -->
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1">
            <p class="text-xs text-gray-400 font-medium uppercase tracking-wide">Streak</p>
            <p class="text-3xl font-black text-orange-500">{{ overview.streak.current }}</p>
            <p class="text-xs text-gray-400">Longest: {{ overview.streak.longest }}</p>
          </div>

          <!-- Mastered -->
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1">
            <p class="text-xs text-gray-400 font-medium uppercase tracking-wide">Mastered</p>
            <p class="text-3xl font-black text-emerald-600">{{ overview.signs.mastered }}</p>
            <p class="text-xs text-gray-400">{{ overview.signs.learning }} learning</p>
          </div>
        </div>

        <!-- Mastered signs -->
        <section v-if="mastered.length > 0" class="flex flex-col gap-3">
          <h2 class="text-sm font-semibold text-gray-700">
            Mastered
            <span class="ml-1 text-xs text-gray-400 font-normal">({{ mastered.length }})</span>
          </h2>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div
              v-for="s in mastered"
              :key="s.id"
              class="bg-white rounded-2xl border border-emerald-100 shadow-sm p-4 flex flex-col gap-2"
            >
              <span class="text-3xl font-black text-gray-900">{{ s.signs.display_text }}</span>
              <div class="h-1 rounded-full bg-gray-100 overflow-hidden">
                <div
                  class="h-full rounded-full bg-emerald-500 transition-all"
                  :style="{ width: masteryBarWidth(s.mastery_score) }"
                />
              </div>
              <div class="flex items-center justify-between">
                <p class="text-xs text-gray-400">{{ s.times_seen }} seen</p>
                <p v-if="accuracyLabel(s)" class="text-xs text-emerald-600 font-medium">{{ accuracyLabel(s) }}</p>
              </div>
            </div>
          </div>
        </section>

        <!-- Learning signs -->
        <section v-if="learning.length > 0" class="flex flex-col gap-3">
          <h2 class="text-sm font-semibold text-gray-700">
            Learning
            <span class="ml-1 text-xs text-gray-400 font-normal">({{ learning.length }})</span>
          </h2>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div
              v-for="s in learning"
              :key="s.id"
              class="bg-white rounded-2xl border border-sky-100 shadow-sm p-4 flex flex-col gap-2"
            >
              <span class="text-3xl font-black text-gray-900">{{ s.signs.display_text }}</span>
              <div class="h-1 rounded-full bg-gray-100 overflow-hidden">
                <div
                  class="h-full rounded-full bg-sky-500 transition-all"
                  :style="{ width: masteryBarWidth(s.mastery_score) }"
                />
              </div>
              <div class="flex items-center justify-between">
                <p class="text-xs text-gray-400">{{ s.times_seen }} seen</p>
                <p v-if="accuracyLabel(s)" class="text-xs text-sky-600 font-medium">{{ accuracyLabel(s) }}</p>
              </div>
            </div>
          </div>
        </section>

        <!-- Not yet seen -->
        <section v-if="unseen.length > 0" class="flex flex-col gap-3">
          <h2 class="text-sm font-semibold text-gray-700">
            Not yet seen
            <span class="ml-1 text-xs text-gray-400 font-normal">({{ unseen.length }})</span>
          </h2>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div
              v-for="s in unseen"
              :key="s.id"
              class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2 opacity-60"
            >
              <span class="text-3xl font-black text-gray-400">{{ s.signs.display_text }}</span>
              <p class="text-xs text-gray-400">{{ s.signs.category ?? s.signs.sign_type ?? '' }}</p>
            </div>
          </div>
        </section>

        <!-- Entirely empty -->
        <div v-if="allSigns.length === 0" class="text-center py-12">
          <p class="text-gray-400 text-sm">No sign data yet. Start a lesson to track your progress.</p>
          <NuxtLink to="/dashboard" class="inline-block mt-3 text-sm text-violet-600 hover:underline">
            Go to dashboard
          </NuxtLink>
        </div>

      </template>

    </main>
  </div>
</template>
