<script setup lang="ts">
const supabase = useSupabaseClient()
const { profile, loadFromCache, clear } = useUserProfile()

// Load cached profile on mount so level/streak show immediately
onMounted(() => loadFromCache())

const signOut = async () => {
  clear()
  await supabase.auth.signOut()
  return navigateTo("/login")
}
</script>

<template>
  <header class="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between sticky top-0 z-40">
    <NuxtLink to="/dashboard" class="text-lg font-bold text-violet-600 tracking-tight">
      Signify
    </NuxtLink>

    <div class="flex items-center gap-5">
      <div v-if="profile && profile.streak.current > 0" class="flex items-center gap-1.5">
        <svg class="w-4 h-4 text-orange-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M13.5 1.5C13.5 1.5 14 8 10 10.5C9.17 11 8 11.5 8 13C8 14.93 9.57 16.5 11.5 16.5C13.43 16.5 15 14.93 15 13C15 12.2 14.67 11.47 14.13 10.94C14.13 10.94 17 13 17 17C17 19.76 14.76 22 12 22C9.24 22 7 19.76 7 17C7 13 9.5 11.5 9.5 11.5C9.5 11.5 7.5 10 7 7C6.5 4 8 1 8 1C8 1 9 4 11 5C11 5 11 2 13.5 1.5Z" />
        </svg>
        <span class="text-sm font-semibold text-orange-500">{{ profile.streak.current }}</span>
      </div>

      <div v-if="profile" class="flex items-center gap-1">
        <span class="text-xs font-medium text-gray-400">Lv</span>
        <span class="text-sm font-bold text-violet-600">{{ profile.level }}</span>
      </div>

      <span v-if="profile?.displayName" class="text-sm text-gray-500 hidden sm:inline">
        {{ profile.displayName }}
      </span>

      <button
        class="text-sm font-medium text-gray-400 hover:text-gray-700 transition-colors"
        @click="signOut"
      >
        Sign out
      </button>
    </div>
  </header>
</template>
