<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()

const signOut = async () => {
  await supabase.auth.signOut()
  return navigateTo('/login')
}
</script>

<template>
  <nav v-if="user" class="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
    <NuxtLink to="/" class="text-base font-semibold text-gray-900 hover:text-blue-600 transition-colors">
      ASL App
    </NuxtLink>

    <div class="flex items-center gap-4">
      <span class="text-sm text-gray-500">{{ user.email }}</span>
      <button
        class="text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
        @click="signOut"
      >
        Sign out
      </button>
    </div>
  </nav>
</template>
