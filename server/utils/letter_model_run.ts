import { join } from 'path'

// NOTE: @tensorflow/tfjs-node cannot load .h5 files directly.
// The Keras model must be converted to TF.js JSON format first using:
//   tensorflowjs_converter --input_format keras \
//     server/models/letter_model/sign_language_model.h5 \
//     server/models/letter_model/tfjs_model/
// This produces server/models/letter_model/tfjs_model/model.json + weights .bin file(s).

// ASL label classes in alphabetical order — Z is intentionally excluded from this system
const LABEL_CLASSES = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y']

// Lazily imported tensorflow — only loaded on first inference call, not at server startup.
// This prevents the native .node binding from crashing during vite-node module evaluation.
let tfModule: typeof import('@tensorflow/tfjs-node') | null = null

async function getTf() {
  if (!tfModule) {
    tfModule = await import('@tensorflow/tfjs-node')
  }
  return tfModule
}

// Singleton model — loaded from disk once and kept in memory
let model: any = null

async function loadModel(): Promise<any> {
  const tf = await getTf()
  if (!model) {
    const modelPath = 'file://' + join(process.cwd(), 'server/models/letter_model/tfjs_model/model.json')
    model = await tf.loadLayersModel(modelPath)
    console.log('[letter_model] Model loaded')
  }
  return model
}

// Converts an array of 21 landmark objects {x, y} to a flat 42-float array [x0, y0, x1, y1, ...]
function landmarksToFeatures(landmarks: Array<{ x: number; y: number }>): Float32Array | null {
  if (!landmarks || landmarks.length !== 21) return null
  const features = new Float32Array(42)
  for (let i = 0; i < 21; i++) {
    features[i * 2] = landmarks[i].x
    features[i * 2 + 1] = landmarks[i].y
  }
  return features
}

// Replicates the normalization from the Python training code:
// 1. Translate all points to wrist origin (landmark 0)
// 2. Scale by distance from wrist to middle finger tip (landmark 12)
function normalizeFeatures(features: Float32Array): Float32Array | null {
  const wristX = features[0]
  const wristY = features[1]

  const xCoords = new Float32Array(21)
  const yCoords = new Float32Array(21)

  for (let i = 0; i < 21; i++) {
    xCoords[i] = features[i * 2] - wristX
    yCoords[i] = features[i * 2 + 1] - wristY
  }

  // Hand size = distance from wrist to middle finger tip (index 12)
  const handSize = Math.sqrt(xCoords[12] ** 2 + yCoords[12] ** 2)
  if (handSize === 0) return null

  const normalized = new Float32Array(42)
  for (let i = 0; i < 21; i++) {
    normalized[i * 2] = xCoords[i] / handSize
    normalized[i * 2 + 1] = yCoords[i] / handSize
  }
  return normalized
}

// Runs inference on a single frame's landmarks.
// Returns the predicted letter and confidence score, or null if landmarks are invalid.
export async function runLetterModel(
  landmarks: Array<{ x: number; y: number }>
): Promise<{ predicted_letter: string; confidence: number } | null> {
  const features = landmarksToFeatures(landmarks)
  if (!features) return null

  const normalized = normalizeFeatures(features)
  if (!normalized) return null

  const tf = await getTf()
  const net = await loadModel()
  const inputTensor = tf.tensor2d([Array.from(normalized)], [1, 42])

  const predTensor = net.predict(inputTensor) as any
  const probabilities = await predTensor.data()

  inputTensor.dispose()
  predTensor.dispose()

  let maxIdx = 0
  let maxProb = probabilities[0]
  for (let i = 1; i < probabilities.length; i++) {
    if (probabilities[i] > maxProb) {
      maxProb = probabilities[i]
      maxIdx = i
    }
  }

  const predicted_letter = LABEL_CLASSES[maxIdx] ?? 'unknown'
  const confidence = Number(maxProb)

  return { predicted_letter, confidence }
}

