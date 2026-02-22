// Routes that do not require authentication
const PUBLIC_ROUTES = ['/login', '/confirm']

export default defineNuxtRouteMiddleware((to) => {
  if (PUBLIC_ROUTES.includes(to.path)) return

  const user = useSupabaseUser()

  // Redirect unauthenticated users to login
  if (!user.value) {
    return navigateTo('/login')
  }
})
