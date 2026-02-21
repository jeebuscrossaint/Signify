<template>
  <div class="p-8 max-w-4xl mx-auto space-y-6">

    <div class="bg-white rounded-2xl p-6 shadow-sm">
      <div v-if="profile">
        <h1 class="text-2xl font-bold text-gray-900">Hey, {{ profile.display_name }} 👋</h1>
        <p class="text-gray-400 text-sm mt-1">
          Level {{ profile.level }} · {{ profile.xp }} XP · Stage: {{ profile.learning_stage }}
        </p>
      </div>
      <div v-else class="space-y-2">
        <div class="h-7 bg-gray-100 rounded animate-pulse w-48" />
        <div class="h-4 bg-gray-100 rounded animate-pulse w-64" />
      </div>
    </div>

    <div v-if="streak" class="bg-white rounded-2xl p-6 shadow-sm">
      <p class="text-sm font-medium text-gray-500 mb-1">Current Streak</p>
      <p class="text-4xl font-bold text-orange-500">🔥 {{ streak.current_streak }} days</p>
      <p class="text-xs text-gray-400 mt-1">Longest: {{ streak.longest_streak }} days</p>
    </div>

    <div class="bg-white rounded-2xl p-6 shadow-sm">
      <h2 class="font-semibold text-gray-700 mb-4">Signs in Database</h2>
      <div v-if="signsLoading" class="text-gray-400 text-sm">Loading...</div>
      <div v-else class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div v-for="sign in signs" :key="sign.id"
          class="border border-gray-100 rounded-xl p-3 text-center hover:border-brand-300 transition-colors">
          <p class="text-2xl font-bold text-brand-600">{{ sign.display_text }}</p>
          <p class="text-xs text-gray-400 mt-1 capitalize">{{ sign.sign_type }}</p>
        </div>
      </div>
    </div>

    <button @click="signOut" class="text-sm text-gray-400 hover:text-gray-600 transition-colors">
      Sign out
    </button>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const { call } = useApi()
const router = useRouter()

const profile = ref<any>(null)
const streak = ref<any>(null)
const signs = ref<any[]>([])
const signsLoading = ref(true)

onMounted(async () => {
  try {
    const result = await call<any>('/api/user/profile')
    profile.value = result.profile
    streak.value = result.streak
  } catch (e) {
    console.error('Profile fetch failed:', e)
  }

  const { data } = await supabase
    .from('signs')
    .select('*')
    .eq('is_active', true)
    .order('difficulty')

  signs.value = data ?? []
  signsLoading.value = false
})

async function signOut() {
  await supabase.auth.signOut()
  await router.push('/auth/login')
}
</script>