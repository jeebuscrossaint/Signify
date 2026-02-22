<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()

const sign = ref<'in' | 'up'>('in')
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

watchEffect(() => {
  if (user.value) {
    return navigateTo('/')
  }
})

const signIn = async () => {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })
  if (error) errorMsg.value = error.message
}

const signUp = async () => {
  const { error } = await supabase.auth.signUp({
    email: email.value,
    password: password.value,
  })
  if (error) {
    errorMsg.value = error.message
  } else {
    successMsg.value = 'Account created! Signing you in...'
    await signIn()
  }
}

const onSubmit = async () => {
  errorMsg.value = ''
  successMsg.value = ''
  loading.value = true
  if (sign.value === 'in') await signIn()
  else await signUp()
  loading.value = false
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
      <h1 class="text-2xl font-semibold text-gray-900 mb-6 text-center">
        {{ sign === 'in' ? 'Sign in' : 'Sign up' }}
      </h1>

      <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
        <div class="flex flex-col gap-1">
          <label for="email" class="text-sm font-medium text-gray-700">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            placeholder="Enter your email"
            class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label for="password" class="text-sm font-medium text-gray-700">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            placeholder="Enter your password"
            class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>
        <p v-if="successMsg" class="text-sm text-green-600">{{ successMsg }}</p>

        <button
          type="submit"
          :disabled="loading"
          class="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-sm rounded-lg px-4 py-2 transition-colors"
        >
          {{ loading ? 'Loading...' : sign === 'in' ? 'Sign in' : 'Sign up' }}
        </button>
      </form>

      <p class="mt-4 text-center text-sm text-gray-600">
        {{ sign === 'in' ? "Don't have an account?" : 'Already have an account?' }}
        <button
          class="text-blue-600 hover:underline font-medium ml-1"
          @click="sign = sign === 'in' ? 'up' : 'in'; errorMsg = ''; successMsg = ''"
        >
          {{ sign === 'in' ? 'Sign up' : 'Sign in' }}
        </button>
      </p>
    </div>
  </div>
</template>
