/**
 * Foresta V2 - Claude LLM Client
 * Wrapper with retry logic and error handling
 */

import Anthropic from '@anthropic-ai/sdk'
import { ForestaError } from '../db/client.js'

// ============================================
// CLIENT SINGLETON
// ============================================
let anthropicInstance: Anthropic | null = null

function getAnthropic(): Anthropic {
  if (anthropicInstance) {
    return anthropicInstance
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new ForestaError(
      'CONFIG_ERROR',
      'Missing ANTHROPIC_API_KEY environment variable'
    )
  }

  anthropicInstance = new Anthropic({ apiKey })
  return anthropicInstance
}

// For testing
export function resetLLMClient(): void {
  anthropicInstance = null
}

// ============================================
// LLM CALL OPTIONS
// ============================================
export interface LLMOptions {
  maxRetries?: number
  timeoutMs?: number
  temperature?: number
  maxTokens?: number
}

const DEFAULT_OPTIONS: Required<LLMOptions> = {
  maxRetries: 3,
  timeoutMs: 10000,
  temperature: 0.7,
  maxTokens: 1024
}

// ============================================
// MAIN CALL FUNCTION
// ============================================
export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  options: LLMOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const anthropic = getAnthropic()

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      const response = await Promise.race([
        anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: opts.maxTokens,
          temperature: opts.temperature,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        }),
        timeoutPromise(opts.timeoutMs)
      ])

      // Extract text from response
      const content = response.content[0]
      if (content.type !== 'text') {
        throw new ForestaError('LLM_ERROR', 'Unexpected response type from Claude')
      }

      return content.text
    } catch (error) {
      lastError = error as Error

      // Don't retry on certain errors
      if (error instanceof ForestaError && error.code === 'CONFIG_ERROR') {
        throw error
      }

      // Log retry attempt
      console.warn(`LLM call attempt ${attempt}/${opts.maxRetries} failed:`, (error as Error).message)

      // Wait before retry (exponential backoff)
      if (attempt < opts.maxRetries) {
        await sleep(Math.pow(2, attempt) * 500)
      }
    }
  }

  throw ForestaError.llm(
    `LLM call failed after ${opts.maxRetries} attempts`,
    { lastError: lastError?.message }
  )
}

// ============================================
// STRUCTURED CALL (JSON OUTPUT)
// ============================================
/**
 * Call LLM expecting JSON response.
 * Returns `unknown` - callers MUST validate with Zod before using.
 * The generic parameter is kept for backward compatibility but does not validate.
 */
export async function callLLMJson<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  options: LLMOptions = {}
): Promise<T> {
  const jsonSystemPrompt = `${systemPrompt}

IMPORTANT: You MUST respond with valid JSON only. No markdown, no code blocks, just raw JSON.`

  const response = await callLLM(jsonSystemPrompt, userPrompt, options)

  // Clean response (remove potential markdown)
  let cleaned = response.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  }
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }
  cleaned = cleaned.trim()

  try {
    // Note: Returns parsed JSON. Callers must validate with Zod schemas.
    return JSON.parse(cleaned) as T
  } catch {
    throw ForestaError.llm('Failed to parse LLM JSON response', { response: cleaned })
  }
}

// ============================================
// HELPERS
// ============================================
function timeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`LLM call timed out after ${ms}ms`)), ms)
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================
// HEALTH CHECK
// ============================================
export async function checkLLMHealth(): Promise<boolean> {
  try {
    await callLLM(
      'You are a health check bot.',
      'Respond with just "ok"',
      { maxRetries: 1, timeoutMs: 5000, maxTokens: 10 }
    )
    return true
  } catch {
    return false
  }
}
