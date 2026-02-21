export function useApi() {
  const supabase = useSupabaseClient()

  async function call<T>(path: string, options: Record<string, any> = {}): Promise<T> {
    const { data: { session } } = await supabase.auth.getSession()

    return await $fetch<T>(path, {
      ...options,
      headers: {
        ...(session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {}),
        ...options.headers,
      },
    })
  }

  return { call }
}