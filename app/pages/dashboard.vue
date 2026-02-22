<script setup lang="ts">
import type { Database } from '~/types/database.types'

const supabase = useSupabaseClient<Database>()
const authUser = useSupabaseUser()

// Redirect to login if not authenticated
watchEffect(() => {
  if (authUser.value === null) {
    return navigateTo('/login')
  }
})

// Fetch user profile from the users table
const { data: profile } = await useAsyncData('profile', async () => {
  if (!authUser.value) return null
  const { data } = await supabase
    .from('users')
    .select('display_name, xp, level, learning_stage')
    .eq('id', authUser.value.id)
    .single()
  return data
})

// Fetch a sample of signs
const { data: signs, pending: signsPending } = await useAsyncData('signs', async () => {
  const { data } = await supabase
    .from('signs')
    .select('id, display_text, category, difficulty, sign_type, ai_description, ai_mnemonic')
    .eq('is_active', true)
    .order('difficulty', { ascending: true })
    .limit(12)
  return data ?? []
})

const displayName = computed(
  () => profile.value?.display_name ?? authUser.value?.email ?? 'User'
)

const difficultyLabel = (d: number | null) => {
  if (!d) return 'Beginner'
  if (d <= 2) return 'Beginner'
  if (d <= 4) return 'Intermediate'
  return 'Advanced'
}

const difficultyColor = (d: number | null) => {
  if (!d || d <= 2) return 'text-green-600 bg-green-50'
  if (d <= 4) return 'text-yellow-600 bg-yellow-50'
  return 'text-red-600 bg-red-50'
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <Nav />

    <main class="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-8">

      <!-- User stats -->
      <section v-if="profile" class="grid grid-cols-3 gap-4">
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-1">
          <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Level</p>
          <p class="text-3xl font-bold text-gray-900">{{ profile.level ?? 1 }}</p>
        </div>
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-1">
          <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">XP</p>
          <p class="text-3xl font-bold text-blue-600">{{ profile.xp ?? 0 }}</p>
        </div>
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-1">
          <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Stage</p>
          <p class="text-3xl font-bold text-gray-900 capitalize">{{ profile.learning_stage ?? '—' }}</p>
        </div>
      </section>

      <!-- Signs -->
      <section>
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Signs to Learn</h2>

        <div v-if="signsPending" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          <div
            v-for="i in 8"
            :key="i"
            class="bg-white rounded-2xl border border-gray-100 p-5 h-32 animate-pulse"
          />
        </div>

        <div v-else-if="signs && signs.length" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          <div
            v-for="sign in signs"
            :key="sign.id"
            class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-2 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div class="flex items-start justify-between gap-2">
              <span class="text-2xl font-bold text-gray-900">{{ sign.display_text }}</span>
              <span
                class="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
                :class="difficultyColor(sign.difficulty)"
              >
                {{ difficultyLabel(sign.difficulty) }}
              </span>
            </div>
            <p v-if="sign.category" class="text-xs text-gray-400 uppercase tracking-wide">{{ sign.category }}</p>
            <p v-if="sign.ai_description" class="text-xs text-gray-600 line-clamp-2">{{ sign.ai_description }}</p>
          </div>
        </div>

        <p v-else class="text-sm text-gray-500">No signs found.</p>
      </section>
    </main>
  </div>
</template>
