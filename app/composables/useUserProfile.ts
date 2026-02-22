// Caches user overview stats in localStorage so they're available immediately
// on page load without an extra round-trip. Refreshed after lesson/practice completions.

const STORAGE_KEY = 'signify_profile_v1'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export interface UserProfile {
  displayName: string | null
  xp: number
  level: number
  learningStage: string
  streak: {
    current: number
    longest: number
    lastActivity: string | null
  }
  signs: {
    total_seen: number
    mastered: number
    learning: number
  }
  lessonsCompleted: number
  cachedAt: number
}

export function useUserProfile() {
  // useState key is stable so all callers share the same reactive instance
  const profile = useState<UserProfile | null>('user-profile', () => null)
  // Load from localStorage into state — call once on app init or page mount
  const loadFromCache = () => {
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed: UserProfile = JSON.parse(raw)
      if (Date.now() - parsed.cachedAt < CACHE_TTL_MS) {
        profile.value = parsed
      }
    } catch {
      // Stale or corrupt cache — ignore
    }
  }

  // Fetch fresh overview data from the API and update cache
  const refresh = async () => {
    try {
      const data = await $fetch<Omit<UserProfile, 'cachedAt'>>('/api/stats/overview')
      const updated: UserProfile = { ...data, cachedAt: Date.now() }
      profile.value = updated
      if (import.meta.client) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      }
    } catch {
      // Silent — page still shows cached or stale data
    }
  }

  // Clear cache on sign out
  const clear = () => {
    profile.value = null
    if (import.meta.client) {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  // Optimistically update display_name and level in state+cache (after profile changes)
  const patch = (updates: Partial<Pick<UserProfile, 'displayName' | 'xp' | 'level' | 'learningStage'>>) => {
    if (!profile.value) return
    profile.value = { ...profile.value, ...updates, cachedAt: Date.now() }
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile.value))
    }
  }

  return { profile: readonly(profile), loadFromCache, refresh, clear, patch }
}
