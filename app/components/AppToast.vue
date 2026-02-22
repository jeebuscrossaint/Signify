<script setup lang="ts">
const { toasts, remove } = useAppToast()

// Map toast type to background/text colors
const typeClasses = (type: string) => ({
  error: 'bg-red-600 text-white',
  success: 'bg-emerald-600 text-white',
  info: 'bg-gray-800 text-white',
}[type] ?? 'bg-gray-800 text-white')
</script>

<template>
  <!-- Fixed container at bottom-right; stacks toasts vertically from the bottom -->
  <div
    aria-live="polite"
    aria-atomic="false"
    class="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end pointer-events-none"
  >
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto max-w-sm w-full rounded-xl px-4 py-3 text-sm font-medium shadow-lg flex items-center justify-between gap-3"
        :class="typeClasses(toast.type)"
      >
        <span>{{ toast.message }}</span>
        <button
          class="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
          @click="remove(toast.id)"
        >
          <!-- Close icon -->
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(16px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>
