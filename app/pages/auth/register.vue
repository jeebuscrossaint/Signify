<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="bg-white p-8 rounded-2xl shadow-sm w-full max-w-md">
      <h1 class="text-2xl font-bold text-gray-900 mb-1">Create your account</h1>
      <p class="text-gray-400 mb-6 text-sm">Start learning ASL today</p>

      <form @submit.prevent="handleRegister" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
          <input v-model="displayName" type="text" required placeholder="What should we call you?"
            class="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input v-model="email" type="email" required
            class="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input v-model="password" type="password" required placeholder="At least 6 characters"
            class="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>

        <p v-if="errorMsg" class="text-red-500 text-sm">{{ errorMsg }}</p>

        <button type="submit" :disabled="loading"
          class="w-full bg-brand-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors">
          {{ loading ? 'Creating account...' : 'Create Account' }}
        </button>
      </form>

      <p class="text-center text-sm text-gray-400 mt-4">
        Already have an account?
        <NuxtLink to="/auth/login" class="text-brand-600 font-medium">Sign in</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ 
  layout: false,  // no layout wrapper on auth pages
})

const supabase = useSupabaseClient()
const router = useRouter()

const displayName = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function handleRegister() {
  loading.value = true
  errorMsg.value = ''

  const { error } = await supabase.auth.signUp({
    email: email.value,
    password: password.value,
    options: {
      data: { display_name: displayName.value }
    }
  })

  if (error) {
    errorMsg.value = error.message
    loading.value = false
    return
  }

  await router.push('/dashboard')
}
</script>