<script setup lang="ts">
const route = useRoute()
const toast = useAppToast()
const sessionId = route.params.id as string

// --- Types ---
interface ProblemSign {
  id: string
  slug: string
  display_text: string
  sign_type: string | null
  ai_mnemonic: string | null
  videoUrl: string | null
}

interface Problem {
  id: string
  problem_type: string | null
  prompt_text: string | null
  video_path: string | null
  knowledge_bucket: string | null
  is_correct: boolean | null
  answered_at: string | null
  sign_id: string | null
  signs: ProblemSign
}

interface Session {
  id: string
  status: string | null
  session_type: string | null
  total_problems: number | null
  correct_count: number | null
  score: number | null
  practice_problems: Problem[]
}

// --- Fetch session ---
const { data, error } = await useAsyncData('practice-' + sessionId, () =>
  $fetch<{ session: Session }>(`/api/practice/${sessionId}`)
)

if (error.value) {
  toast.error('Session not found')
  await navigateTo('/dashboard')
}

const problems = computed<Problem[]>(() => {
  const raw = data.value?.session?.practice_problems ?? []
  // Sort by order they were created (array order from DB is insertion order)
  return [...raw]
})

// Video URLs are now embedded in each problem's signs.videoUrl by the session endpoint.
// We keep videoUrls as a client-side ref so the template can reactively show/hide the video
// without requiring any extra fetch.
const videoUrls = ref<Record<string, string | null>>({})

// Populate videoUrls from the already-fetched session data (no extra HTTP request needed)
const populateVideoUrls = () => {
  for (const p of problems.value) {
    if (p.problem_type === 'watch_and_type') {
      videoUrls.value[p.id] = p.signs?.videoUrl ?? null
    }
  }
}

// Legacy stub kept so any existing callers don't break — now a no-op
// (URLs already present from session response)
const fetchVideoUrl = async (_problem: Problem) => {}

// Current problem index (0-based)
const currentIndex = ref(0)
const currentProblem = computed(() => problems.value[currentIndex.value] ?? null)

// Pre-populate all video URLs from the session data immediately
onMounted(() => { populateVideoUrls() })

// (Legacy watch kept to avoid breaking anything — populateVideoUrls already covers all)
watch(currentIndex, async (idx) => {
  const p = problems.value[idx]
  if (p) await fetchVideoUrl(p)
})

// --- Answer state ---
type Phase = 'answering' | 'feedback' | 'finishing' | 'results'
const phase = ref<Phase>('answering')

const typedAnswer = ref('')
const submitting = ref(false)

// Feedback from the server after submitting an answer
const feedbackResult = ref<{
  is_correct: boolean
  correct_answer: string | null
  confidence: number | null
  detected_sign: string | null
  hint: string | null
  first_time_mastered: boolean
} | null>(null)

// Camera ref for sign_to_camera problems
const cameraRef = ref<{ currentLandmarks: Array<{ x: number; y: number }> | null } | null>(null)

// Submit an answer for the current problem
const submitAnswer = async () => {
  const problem = currentProblem.value
  if (!problem) return
  submitting.value = true

  try {
    let body: Record<string, unknown> = {}

    if (problem.problem_type === 'watch_and_type') {
      if (!typedAnswer.value.trim()) {
        toast.error('Please type an answer')
        submitting.value = false
        return
      }
      body = { typed_answer: typedAnswer.value.trim() }
    } else if (problem.problem_type === 'sign_to_camera') {
      const lm = cameraRef.value?.currentLandmarks
      if (!lm || lm.length === 0) {
        toast.error('No hand detected — make sure your hand is visible in the camera')
        submitting.value = false
        return
      }
      body = { landmarks: lm }
    }

    const result = await $fetch<{
      is_correct: boolean
      correct_answer: string | null
      confidence: number | null
      detected_sign: string | null
      hint: string | null
      first_time_mastered: boolean
    }>(`/api/practice/${sessionId}/problems/${problem.id}/answer`, {
      method: 'POST',
      body,
    })

    feedbackResult.value = result
    phase.value = 'feedback'
  } catch (err: any) {
    toast.error(err?.data?.statusMessage ?? 'Could not submit answer')
  } finally {
    submitting.value = false
  }
}

// Advance to next problem or move to finishing
const goNext = async () => {
  feedbackResult.value = null
  typedAnswer.value = ''
  const nextIndex = currentIndex.value + 1

  if (nextIndex >= problems.value.length) {
    // All problems answered — ready to finish
    phase.value = 'finishing'
  } else {
    currentIndex.value = nextIndex
    phase.value = 'answering'
    // Prefetch next-next URL
    const next = problems.value[nextIndex + 1]
    if (next) fetchVideoUrl(next)
  }
}

// --- Session completion ---
const finishing = ref(false)

const finishResults = ref<{
  score: number
  correctCount: number
  totalProblems: number
  xp: number
  level: number
  streak: { current: number; longest: number }
  newStage: string | null
} | null>(null)

const finishSession = async () => {
  finishing.value = true
  try {
    const result = await $fetch<{
      score: number
      correctCount: number
      totalProblems: number
      xp: number
      level: number
      // API returns DB column names: current_streak / longest_streak
      streak: { current_streak: number; longest_streak: number } | null
      newStage: string | null
    }>(`/api/practice/${sessionId}/complete`, { method: 'POST' })

    // Map DB column names to friendlier shape for the template
    finishResults.value = {
      ...result,
      streak: {
        current: result.streak?.current_streak ?? 0,
        longest: result.streak?.longest_streak ?? 0,
      },
    }
    phase.value = 'results'
  } catch (err: any) {
    toast.error(err?.data?.statusMessage ?? 'Could not finish session')
  } finally {
    finishing.value = false
  }
}

// --- Helpers ---
const progressPercent = computed(() => {
  const total = problems.value.length
  if (total === 0) return 0
  return Math.round(((currentIndex.value + (phase.value === 'feedback' ? 1 : 0)) / total) * 100)
})

const answeredCount = computed(() => currentIndex.value + (phase.value === 'feedback' || phase.value === 'finishing' || phase.value === 'results' ? 1 : 0))
const totalCount = computed(() => problems.value.length)

const scorePercent = computed(() =>
  finishResults.value ? Math.round(finishResults.value.score * 100) : 0
)
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <Nav />

    <main class="max-w-2xl mx-auto px-4 sm:px-6 py-8">

      <!-- Progress -->
      <div v-if="phase !== 'results'" class="mb-6">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-gray-400">
            {{ answeredCount }} / {{ totalCount }}
          </span>
          <span class="text-xs font-medium text-gray-400 capitalize">{{ data?.session?.session_type?.replace('_', ' ') }}</span>
        </div>
        <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            class="h-full bg-violet-500 rounded-full transition-all duration-300"
            :style="{ width: progressPercent + '%' }"
          />
        </div>
      </div>

      <!-- Results screen -->
      <div v-if="phase === 'results' && finishResults" class="flex flex-col items-center gap-6 py-8">
        <div class="text-center">
          <p class="text-sm font-medium text-gray-500 mb-1">Session complete</p>
          <p class="text-6xl font-black" :class="scorePercent >= 80 ? 'text-emerald-500' : scorePercent >= 50 ? 'text-amber-500' : 'text-red-500'">
            {{ scorePercent }}%
          </p>
          <p class="text-gray-500 mt-2">
            {{ finishResults.correctCount }} of {{ finishResults.totalProblems }} correct
          </p>
        </div>

        <!-- Stats from completion -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm w-full p-5 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">XP earned</span>
            <span class="text-sm font-semibold text-violet-600">+{{ finishResults.xp }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Level</span>
            <span class="text-sm font-semibold text-gray-800">{{ finishResults.level }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Streak</span>
            <span class="text-sm font-semibold text-orange-500">{{ finishResults.streak.current }} day{{ finishResults.streak.current !== 1 ? 's' : '' }}</span>
          </div>
        </div>

        <!-- Stage advancement notification -->
        <div
          v-if="finishResults.newStage"
          class="bg-violet-50 border border-violet-200 rounded-2xl w-full p-4 text-center"
        >
          <p class="text-sm font-semibold text-violet-700">
            You advanced to the <span class="capitalize">{{ finishResults.newStage }}</span> stage
          </p>
        </div>

        <div class="flex gap-3 w-full">
          <NuxtLink
            to="/dashboard"
            class="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl px-6 py-3 text-center transition-colors"
          >
            Back to dashboard
          </NuxtLink>
        </div>
      </div>

      <!-- Finishing state (waiting to call complete) -->
      <div v-else-if="phase === 'finishing'" class="flex flex-col gap-4">
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
          <p class="text-lg font-bold text-gray-900 mb-1">All done</p>
          <p class="text-sm text-gray-500">You answered all {{ totalCount }} problems.</p>
        </div>
        <button
          class="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold rounded-xl px-6 py-4 transition-colors flex items-center justify-center gap-2"
          :disabled="finishing"
          @click="finishSession"
        >
          <svg v-if="finishing" class="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          {{ finishing ? 'Saving...' : 'Finish session' }}
        </button>
      </div>

      <!-- Active problem -->
      <div v-else-if="currentProblem" class="flex flex-col gap-4">

        <!-- Watch and type problem -->
        <div v-if="currentProblem.problem_type === 'watch_and_type'" class="flex flex-col gap-4">
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div class="px-5 pt-5 pb-3">
              <p class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">What letter is this?</p>
            </div>

            <!-- Video if available -->
            <div v-if="videoUrls[currentProblem.id]" class="bg-black">
              <video
                :key="videoUrls[currentProblem.id]!"
                :src="videoUrls[currentProblem.id]!"
                class="w-full max-h-64 object-contain mx-auto"
                autoplay
                loop
                muted
                playsinline
                controls
              />
            </div>

            <!-- Large letter fallback when no video -->
            <div v-else class="h-36 bg-linear-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center gap-2 px-4">
              <svg class="w-8 h-8 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z" />
              </svg>
              <p class="text-sm text-gray-400 text-center">Video unavailable.<br>Type the letter you think is being signed.</p>
            </div>

            <!-- Text input -->
            <div class="px-5 py-4">
              <input
                v-model="typedAnswer"
                type="text"
                maxlength="20"
                :disabled="phase === 'feedback'"
                placeholder="Type the letter or word..."
                class="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
                @keydown.enter="phase === 'answering' && submitAnswer()"
              />
            </div>
          </div>
        </div>

        <!-- Sign to camera problem -->
        <div v-else-if="currentProblem.problem_type === 'sign_to_camera'" class="flex flex-col gap-4">
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Sign this letter</p>
            <p class="text-5xl font-black text-gray-900">{{ currentProblem.signs?.display_text }}</p>
          </div>

          <!-- Camera view (client only to prevent SSR errors) -->
          <ClientOnly>
            <HandCamera ref="cameraRef" />
            <template #fallback>
              <div class="w-full aspect-video bg-gray-800 rounded-2xl flex items-center justify-center">
                <span class="text-sm text-gray-400">Loading camera...</span>
              </div>
            </template>
          </ClientOnly>
        </div>

        <!-- Feedback overlay (shown after submitting) -->
        <div
          v-if="phase === 'feedback' && feedbackResult"
          class="rounded-2xl border px-5 py-4"
          :class="feedbackResult.is_correct ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'"
        >
          <p class="font-semibold" :class="feedbackResult.is_correct ? 'text-emerald-700' : 'text-red-700'">
            {{ feedbackResult.is_correct ? 'Correct' : `Incorrect — the answer is "${feedbackResult.correct_answer}"` }}
          </p>

          <!-- Confidence for camera-based answers -->
          <p
            v-if="feedbackResult.confidence !== null"
            class="text-xs mt-1"
            :class="feedbackResult.is_correct ? 'text-emerald-600' : 'text-red-600'"
          >
            Detected: {{ feedbackResult.detected_sign }}
            ({{ Math.round((feedbackResult.confidence ?? 0) * 100) }}% confidence)
          </p>

          <!-- First time mastered celebration -->
          <p
            v-if="feedbackResult.first_time_mastered"
            class="text-xs font-medium text-violet-600 mt-1"
          >
            Sign mastered for the first time.
          </p>

          <!-- Hint / mnemonic shown when incorrect -->
          <div v-if="feedbackResult.hint && !feedbackResult.is_correct" class="mt-3 bg-white/70 rounded-lg px-3 py-2">
            <p class="text-xs font-semibold text-amber-600 mb-0.5">Memory tip</p>
            <p class="text-xs text-gray-700">{{ feedbackResult.hint }}</p>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="flex gap-3">
          <!-- Submit (answering state) -->
          <button
            v-if="phase === 'answering'"
            class="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold rounded-xl px-6 py-3 transition-colors flex items-center justify-center gap-2"
            :disabled="submitting"
            @click="submitAnswer"
          >
            <svg v-if="submitting" class="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            {{ submitting ? 'Checking...' : 'Submit' }}
          </button>

          <!-- Next (feedback state) -->
          <button
            v-else-if="phase === 'feedback'"
            class="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl px-6 py-3 transition-colors"
            @click="goNext"
          >
            {{ currentIndex + 1 >= problems.length ? 'See results' : 'Next' }}
          </button>
        </div>

      </div>

    </main>
  </div>
</template>
