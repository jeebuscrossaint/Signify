// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
   modules: [
    '@nuxtjs/supabase',
    '@nuxtjs/tailwindcss',
  ],

  css: ['~/assets/css/main.css'],

  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_ANON_KEY,
    redirect: true,
    redirectOptions: {
      login: '/auth/login',
      callback: '/confirm',
      exclude: ['/', '/auth/register', '/auth/login'],
    },
    cookieOptions: {
      maxAge: 60 * 60 * 8,
      sameSite: 'lax',
      secure: false,   // set true in production with HTTPS
    },
  },

  runtimeConfig: {
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    modelEndpoint: process.env.MODEL_ENDPOINT,
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
    }
  },
})
