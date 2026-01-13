/**
 * Foresta V2 - Supabase Client
 * Singleton client with ForestaError handling
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ============================================
// FORESTA ERROR
// ============================================
export class ForestaError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ForestaError'
  }

  static fromSupabase(error: { code?: string; message: string }): ForestaError {
    return new ForestaError(
      error.code || 'SUPABASE_ERROR',
      error.message
    )
  }

  static notFound(entity: string, identifier: string): ForestaError {
    return new ForestaError(
      'NOT_FOUND',
      `${entity} not found: ${identifier}`
    )
  }

  static validation(message: string, details?: unknown): ForestaError {
    return new ForestaError('VALIDATION_ERROR', message, details)
  }

  static llm(message: string, details?: unknown): ForestaError {
    return new ForestaError('LLM_ERROR', message, details)
  }
}

// ============================================
// SUPABASE CLIENT SINGLETON
// ============================================
let supabaseInstance: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance
  }

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) {
    throw new ForestaError(
      'CONFIG_ERROR',
      'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables'
    )
  }

  supabaseInstance = createClient(url, key)
  return supabaseInstance
}

// For testing - reset singleton
export function resetSupabase(): void {
  supabaseInstance = null
}

// ============================================
// RETRY HELPER FOR CRITICAL OPERATIONS
// ============================================
export interface RetryOptions {
  maxRetries?: number
  delayMs?: number
  backoff?: boolean
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, delayMs = 500, backoff = true } = options

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      console.warn(`Retry attempt ${attempt}/${maxRetries} failed:`, (error as Error).message)

      if (attempt < maxRetries) {
        const waitTime = backoff ? delayMs * attempt : delayMs
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
  }

  throw lastError
}
