<script setup lang="ts">
// MediaPipe Hands is loaded from CDN to avoid WASM bundling issues.
// Required scripts: @mediapipe/hands (includes its own WASM loader).

// Landmark point from MediaPipe — we only use x and y
interface Landmark {
  x: number
  y: number
  z?: number
}

const emit = defineEmits<{
  status: [value: 'ready' | 'detecting' | 'hand-detected' | 'no-hand' | 'error']
}>()

// Exposed so the parent component can grab landmarks on demand
const currentLandmarks = ref<Landmark[] | null>(null)
defineExpose({ currentLandmarks })

const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

// Internal state
const isLoading = ref(true)
const hasHand = ref(false)
const errorMessage = ref<string | null>(null)

let rafId: number | null = null
let handsInstance: any = null
let stream: MediaStream | null = null

// Dynamically load MediaPipe Hands from CDN and return the Hands class
const loadMediaPipeHands = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    // If already loaded from a previous mount, reuse it
    if ((window as any).Hands) {
      resolve((window as any).Hands)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js'
    script.crossOrigin = 'anonymous'
    script.onload = () => {
      if ((window as any).Hands) {
        resolve((window as any).Hands)
      } else {
        reject(new Error('MediaPipe Hands did not load correctly'))
      }
    }
    script.onerror = () => reject(new Error('Failed to load MediaPipe Hands from CDN'))
    document.head.appendChild(script)
  })
}

// Draw landmark dots on the canvas overlay
const drawLandmarks = (landmarks: Landmark[], width: number, height: number) => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  // MediaPipe returns exactly 21 landmarks; guard against unexpected lengths
  if (landmarks.length < 21) return

  ctx.clearRect(0, 0, width, height)

  // Draw dots at each landmark position
  ctx.fillStyle = '#7c3aed'
  for (const lm of landmarks) {
    ctx.beginPath()
    ctx.arc(lm.x * width, lm.y * height, 5, 0, 2 * Math.PI)
    ctx.fill()
  }

  // Draw a simple line from wrist (0) to each finger tip (4, 8, 12, 16, 20)
  ctx.strokeStyle = 'rgba(124, 58, 237, 0.4)'
  ctx.lineWidth = 2
  const fingerTips = [4, 8, 12, 16, 20]
  const wrist = landmarks[0]!
  for (const tip of fingerTips) {
    const tipLm = landmarks[tip]!
    ctx.beginPath()
    ctx.moveTo(wrist.x * width, wrist.y * height)
    ctx.lineTo(tipLm.x * width, tipLm.y * height)
    ctx.stroke()
  }
}

// Start the rAF loop that feeds video frames into MediaPipe
const startDetectionLoop = () => {
  const video = videoRef.value
  if (!video || !handsInstance) return

  const tick = async () => {
    if (video.readyState >= 2) {
      await handsInstance.send({ image: video })
    }
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

onMounted(async () => {
  if (!import.meta.client) return

  try {
    // Step 1: get webcam access
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false,
    })

    const video = videoRef.value
    if (!video) return
    video.srcObject = stream
    await video.play()

    // Step 2: load MediaPipe from CDN
    const HandsClass = await loadMediaPipeHands()

    handsInstance = new HandsClass({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    })

    handsInstance.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })

    // Step 3: set up results callback
    handsInstance.onResults((results: any) => {
      const canvas = canvasRef.value
      if (!canvas) return
      const { width, height } = canvas

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const lms: Landmark[] = results.multiHandLandmarks[0]
        currentLandmarks.value = lms.map(({ x, y }) => ({ x, y }))
        hasHand.value = true
        drawLandmarks(lms, width, height)
        emit('status', 'hand-detected')
      } else {
        currentLandmarks.value = null
        hasHand.value = false
        // Clear canvas when no hand visible
        const ctx = canvas.getContext('2d')
        ctx?.clearRect(0, 0, width, height)
        emit('status', 'no-hand')
      }
    })

    isLoading.value = false
    emit('status', 'ready')

    // Step 4: start sending frames
    startDetectionLoop()
  } catch (err: any) {
    isLoading.value = false
    errorMessage.value =
      err?.name === 'NotAllowedError'
        ? 'Camera access denied. Allow camera access and reload.'
        : 'Could not start camera.'
    emit('status', 'error')
  }
})

onUnmounted(() => {
  // Stop rAF loop
  if (rafId !== null) cancelAnimationFrame(rafId)
  // Release webcam
  if (stream) stream.getTracks().forEach((t) => t.stop())
  // Clean up MediaPipe
  if (handsInstance) handsInstance.close()
})
</script>

<template>
  <div class="relative w-full aspect-video bg-gray-900 rounded-2xl overflow-hidden">
    <!-- Loading overlay -->
    <div
      v-if="isLoading"
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white"
    >
      <svg class="animate-spin w-8 h-8 text-violet-400" viewBox="0 0 24 24" fill="none">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      <span class="text-sm text-gray-300">Starting camera...</span>
    </div>

    <!-- Error state -->
    <div
      v-else-if="errorMessage"
      class="absolute inset-0 flex items-center justify-center text-center px-6"
    >
      <p class="text-sm text-red-400">{{ errorMessage }}</p>
    </div>

    <!-- Live camera feed (mirrored for natural feel) -->
    <video
      ref="videoRef"
      class="w-full h-full object-cover"
      style="transform: scaleX(-1);"
      playsinline
      muted
    />

    <!-- Landmark overlay canvas (also mirrored to match video) -->
    <canvas
      ref="canvasRef"
      width="640"
      height="480"
      class="absolute inset-0 w-full h-full"
      style="transform: scaleX(-1);"
    />

    <!-- Hand detection status indicator -->
    <div
      v-if="!isLoading && !errorMessage"
      class="absolute bottom-3 left-3"
    >
      <div
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
        :class="hasHand ? 'bg-emerald-500/90 text-white' : 'bg-black/50 text-gray-300'"
      >
        <span
          class="w-1.5 h-1.5 rounded-full"
          :class="hasHand ? 'bg-white' : 'bg-gray-400'"
        />
        {{ hasHand ? 'Hand detected' : 'No hand detected' }}
      </div>
    </div>
  </div>
</template>
