<script setup lang="ts">
// Redirect to the appropriate page based on onboarding status.
// The auth middleware already ensures only authenticated users reach this page.

const { data } = await useFetch<{ profile: { onboarding_complete: boolean | null } }>('/api/user/profile')

if (!data.value?.profile?.onboarding_complete) {
  await navigateTo('/onboarding', { replace: true })
} else {
  await navigateTo('/dashboard', { replace: true })
}
</script>

<template>
  <!-- Briefly shown while redirect executes -->
  <div class="min-h-screen bg-gray-50 flex items-center justify-center">
    <svg class="animate-spin w-8 h-8 text-violet-400" viewBox="0 0 24 24" fill="none">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  </div>
</template>
