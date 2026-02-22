import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  css: ['./app/assets/css/main.css'],
  devtools: { enabled: true },
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },

  // Enable WebSocket support for real-time model inference routes.
  // Also mark TensorFlow.js Node as external — it uses native bindings that cannot be bundled.
  nitro: {
    experimental: {
      websocket: true,
    },
    externals: {
      external: ['@tensorflow/tfjs-node'],
    },
  },

  modules: ['@nuxtjs/supabase'],

  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_ANON_KEY,
  },
})