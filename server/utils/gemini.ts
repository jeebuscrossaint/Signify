import { GoogleGenerativeAI } from '@google/generative-ai'
import { createError } from 'h3'
import { readFileSync } from 'fs'
import { join } from 'path'

// Gemini model instance — created once and reused
let geminiModel: ReturnType<InstanceType<typeof GoogleGenerativeAI>['getGenerativeModel']> | null = null

function getModel() {
  if (!geminiModel) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

    // System instruction loaded from file so it stays out of code
    const systemInstruction = readFileSync(
      join(process.cwd(), 'server/prompts/system.txt'),
      'utf-8'
    )

    geminiModel = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    })
  }
  return geminiModel
}

// Replaces all {{marker}} placeholders in a prompt template with provided values.
function saturatePrompt(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w[\w-]*)\}\}/g, (_, key: string): string => {
    return key in values ? (values[key] ?? `{{${key}}}`) : `{{${key}}}`
  })
}

// Reads a prompt template from disk and saturates it with values.
function buildPrompt(filename: string, values: Record<string, string>): string {
  const template = readFileSync(join(process.cwd(), 'server/prompts', filename), 'utf-8')
  return saturatePrompt(template, values)
}

// Sends a prompt to Gemini and parses the JSON response.
// Throws a 502 if Gemini fails or returns invalid JSON.
async function callGemini<T>(prompt: string): Promise<T> {
  const model = getModel()
  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    return JSON.parse(text) as T
  } catch (err) {
    throw createError({ statusCode: 502, statusMessage: 'Gemini request failed: ' + String(err) })
  }
}

// --- Typed Gemini call functions ---

export type GeminiLessonResponse = {
  title: string
  intro_text: string
  lesson_type: 'standard' | 'alphabet_intro' | 'thematic'
  theme: string | null
  signs_to_teach: Array<{
    slug: string
    display_text: string
    reason_chosen: string
  }>
}

export async function geminiGenerateLesson(context: {
  learning_stage: string
  user_level: number
  introduced_slugs: string[]
  learning_slugs: string[]
  is_first_lesson: boolean
  available_signs: Array<{ slug: string; display_text: string; category: string | null; difficulty: number | null }>
  n: number
}): Promise<GeminiLessonResponse> {
  const prompt = buildPrompt('lesson-generate.txt', {
    learning_stage: context.learning_stage,
    user_level: String(context.user_level),
    introduced_slugs: context.introduced_slugs.length ? context.introduced_slugs.join(', ') : 'NONE',
    learning_slugs: context.learning_slugs.length ? context.learning_slugs.join(', ') : 'NONE',
    is_first_lesson: String(context.is_first_lesson),
    available_signs_json: JSON.stringify(context.available_signs, null, 2),
    n: String(context.n),
  })
  return callGemini<GeminiLessonResponse>(prompt)
}

export type GeminiSignDetailResponse = {
  ai_description: string
  ai_mnemonic: string
  ai_fun_fact: string
}

export async function geminiGenerateSignDetail(sign: {
  display_text: string
  sign_type: string | null
  category: string | null
}): Promise<GeminiSignDetailResponse> {
  const prompt = buildPrompt('sign-detail.txt', {
    display_text: sign.display_text,
    sign_type: sign.sign_type ?? 'unknown',
    category: sign.category ?? 'general',
  })
  return callGemini<GeminiSignDetailResponse>(prompt)
}

export type GeminiSentenceResponse = {
  sentence: string
  sign_slugs_in_order: string[]
  grammar_note: string
}

export async function geminiBuildSentence(masteredSigns: Array<{ slug: string; display_text: string }>): Promise<GeminiSentenceResponse> {
  const prompt = buildPrompt('sentence-builder.txt', {
    mastered_signs_json: JSON.stringify(masteredSigns, null, 2),
  })
  return callGemini<GeminiSentenceResponse>(prompt)
}

export async function geminiLetterToWord(tokens: string[]): Promise<string> {
  const prompt = buildPrompt('letter-to-word.txt', {
    tokens: tokens.join(''),
  })
  try {
    const result = await callGemini<{ word: string }>(prompt)
    return result.word?.toLowerCase() ?? tokens.join('').toLowerCase()
  } catch {
    return tokens.join('').toLowerCase()
  }
}
