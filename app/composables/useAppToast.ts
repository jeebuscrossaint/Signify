// Shared toast notification state — module-level so it survives navigation
// Each toast has a unique id, type, and message.
export type ToastType = 'error' | 'success' | 'info'

export interface Toast {
  id: number
  type: ToastType
  message: string
}

// Module-level id counter (plain number, safe at module level)
let _nextId = 0

export function useAppToast() {
  // useState key is stable so all callers share the same reactive array
  const toasts = useState<Toast[]>('app-toasts', () => [])
  const add = (type: ToastType, message: string, duration = 4500) => {
    const id = ++_nextId
    toasts.value.push({ id, type, message })
    // Auto-remove after duration
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id)
    }, duration)
  }

  const remove = (id: number) => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return {
    toasts: readonly(toasts),
    error: (msg: string) => add('error', msg),
    success: (msg: string) => add('success', msg),
    info: (msg: string) => add('info', msg),
    remove,
  }
}
