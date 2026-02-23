<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const toast = useAppToast()

// Redirect authenticated users away from login
watchEffect(() => {
  if (user.value) navigateTo('/dashboard')
})

type Mode = 'in' | 'up'
const mode = ref<Mode>('in')
const email = ref('')
const password = ref('')
const displayName = ref('')
const loading = ref(false)
const errorMsg = ref('')

const switchMode = (m: Mode) => {
  mode.value = m
  errorMsg.value = ''
  email.value = ''
  password.value = ''
  displayName.value = ''
}

// Sign up via our custom endpoint (creates public profile row), then sign in
const handleSignUp = async () => {
  if (!displayName.value.trim()) {
    errorMsg.value = 'Display name is required'
    return
  }
  // Create auth user + public profile
  await $fetch('/api/auth/signup', {
    method: 'POST',
    body: { email: email.value, password: password.value, display_name: displayName.value.trim() },
  })
  // Log in immediately after signup
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })
  if (signInError) throw new Error(signInError.message)
}

// Standard sign in via Supabase client
const handleSignIn = async () => {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })
  if (error) throw new Error(error.message)
}

// After successful sign in, check onboarding status and redirect
const redirectAfterAuth = async (isNewUser: boolean) => {
  if (isNewUser) {
    return navigateTo('/dashboard')
  }
  // Fetch onboarding flag from the profile
  try {
    const data = await $fetch<{ profile: { onboarding_complete: boolean } }>('/api/user/profile')
    if (!data.profile.onboarding_complete) {
      return navigateTo('/dashboard')
    }
  } catch {
    // If profile fetch fails just go to dashboard
  }
  return navigateTo('/dashboard')
}

const onSubmit = async () => {
  errorMsg.value = ''
  loading.value = true
  try {
    if (mode.value === 'up') {
      await handleSignUp()
      await redirectAfterAuth(true)
    } else {
      await handleSignIn()
      await redirectAfterAuth(false)
    }
  } catch (err: any) {
    errorMsg.value = err?.data?.statusMessage ?? err?.message ?? 'Something went wrong'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-sm">
      <!-- Logo / brand -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-violet-600">Signify</h1>
        <p class="text-sm text-gray-500 mt-1">Learn American Sign Language</p>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <!-- Mode toggle -->
        <div class="flex rounded-xl overflow-hidden border border-gray-200 mb-6">
          <button
            class="flex-1 py-2 text-sm font-medium transition-colors"
            :class="mode === 'in' ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'"
            @click="switchMode('in')"
          >
            Sign in
          </button>
          <button
            class="flex-1 py-2 text-sm font-medium transition-colors"
            :class="mode === 'up' ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'"
            @click="switchMode('up')"
          >
            Sign up
          </button>
        </div>

        <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
          <!-- Display name (signup only) -->
          <div v-if="mode === 'up'" class="flex flex-col gap-1">
            <label for="display_name" class="text-sm font-medium text-gray-700">Display name</label>
            <input
              id="display_name"
              v-model="displayName"
              type="text"
              required
              autocomplete="nickname"
              placeholder="How should we call you?"
              class="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label for="email" class="text-sm font-medium text-gray-700">Email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
              placeholder="you@example.com"
              class="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label for="password" class="text-sm font-medium text-gray-700">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              required
              autocomplete="current-password"
              placeholder="Password"
              class="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          <!-- Inline error -->
          <p v-if="errorMsg" class="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {{ errorMsg }}
          </p>

          <button
            type="submit"
            :disabled="loading"
            class="mt-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium text-sm rounded-xl px-4 py-2.5 transition-colors"
          >
            {{ loading ? 'Please wait...' : mode === 'in' ? 'Sign in' : 'Create account' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
