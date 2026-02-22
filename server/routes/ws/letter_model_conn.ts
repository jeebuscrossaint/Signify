import { runLetterModel } from '~~/server/utils/letter_model_run'
import { geminiLetterToWord } from '~~/server/utils/gemini'

// Max letters in the token buffer before auto-sending to Gemini for word prediction
const TOKEN_BUFFER_MAX = 5
// Minimum milliseconds between accepted letters (8 seconds — mirrors Python debounce)
const DEBOUNCE_MS = 8000
// Confidence threshold below which a predicted letter is ignored
const CONFIDENCE_THRESHOLD = 0.7

// Per-connection state — keyed by peer.id
const peerState = new Map<string, {
  tokenBuffer: string[]
  lastLetterAddedAt: number
}>()

export default defineWebSocketHandler({
  open(peer) {
    // Initialize fresh state for this connection
    peerState.set(peer.id, {
      tokenBuffer: [],
      lastLetterAddedAt: Date.now(),
    })
  },

  async message(peer, message) {
    let data: any
    try {
      data = JSON.parse(message.text())
    } catch {
      peer.send(JSON.stringify({ error: 'Invalid JSON' }))
      return
    }

    const state = peerState.get(peer.id)
    if (!state) return

    // Handle buffer reset command from the client
    if (data.reset) {
      state.tokenBuffer = []
      state.lastLetterAddedAt = Date.now()
      peer.send(JSON.stringify({ status: 'buffer_cleared' }))
      return
    }

    // Handle manual word generation request (client triggers early before buffer is full)
    if (data.generate_word) {
      if (state.tokenBuffer.length > 0) {
        const word = await geminiLetterToWord(state.tokenBuffer)
        peer.send(JSON.stringify({ word_prediction: word }))
        state.tokenBuffer = []
      } else {
        peer.send(JSON.stringify({ word_prediction: '' }))
      }
      return
    }

    // Normal frame: array of 21 landmark objects with {x, y} from MediaPipe
    const landmarks: Array<{ x: number; y: number }> = data.landmarks
    if (!Array.isArray(landmarks) || landmarks.length !== 21) {
      peer.send(JSON.stringify({ error: 'Invalid landmarks — expected 21 points' }))
      return
    }

    // Run letter model inference
    const result = await runLetterModel(landmarks)
    if (!result) {
      peer.send(JSON.stringify({ error: 'Model could not process frame' }))
      return
    }

    const { predicted_letter, confidence } = result
    const now = Date.now()
    const timeSinceLast = now - state.lastLetterAddedAt

    // Add letter to buffer only when confident enough and debounce window has passed
    if (confidence >= CONFIDENCE_THRESHOLD && timeSinceLast >= DEBOUNCE_MS) {
      state.tokenBuffer.push(predicted_letter)
      state.lastLetterAddedAt = now
    }

    const response: Record<string, unknown> = {
      predicted_letter,
      confidence,
      tokens: [...state.tokenBuffer],
      time_since_last: timeSinceLast / 1000, // return in seconds to match Python client expectations
      debounce_time: DEBOUNCE_MS / 1000,
    }

    // Auto-trigger Gemini word prediction when buffer reaches max capacity
    if (state.tokenBuffer.length >= TOKEN_BUFFER_MAX) {
      const word = await geminiLetterToWord(state.tokenBuffer)
      response.word_prediction = word
      state.tokenBuffer = []
    }

    peer.send(JSON.stringify(response))
  },

  close(peer) {
    peerState.delete(peer.id)
  },

  error(peer, _error) {
    peerState.delete(peer.id)
  },
})
