/**
 * Foresta V2 - LLM Response Validation
 * Zod schemas with fallback handling
 */

import { z } from 'zod'
import type { ActionResult, Destin, Palier } from '../types/entities.js'
import { ForestaError } from '../db/client.js'

// ============================================
// ACTION RESPONSE SCHEMA
// ============================================
export const ActionResponseSchema = z.object({
  action: z.string().min(1),
  lieu_fin: z.string().min(1),
  cible: z.string().nullable(),
  narration: z.string().min(1)
})

export type ActionResponseRaw = z.infer<typeof ActionResponseSchema>

// ============================================
// DESTIN RESPONSE SCHEMA
// ============================================
export const PalierSchema = z.object({
  jour_cible: z.number().int().positive(),
  description: z.string().min(1),
  atteint: z.boolean()
})

export const DestinResponseSchema = z.object({
  fin_ecrite: z.string().min(1),
  paliers: z.array(PalierSchema).min(1).max(5),
  inclination_actuelle: z.string().min(1)
})

export type DestinResponseRaw = z.infer<typeof DestinResponseSchema>

// ============================================
// RESUME RESPONSE SCHEMA
// ============================================
export const ResumeResponseSchema = z.object({
  resume: z.string().min(1)
})

export type ResumeResponseRaw = z.infer<typeof ResumeResponseSchema>

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate and transform action response
 */
export function validateActionResponse(
  raw: unknown,
  lieuxAccessibles: string[],
  personnagesPresents: string[]
): ActionResult {
  // Parse with Zod
  const parsed = ActionResponseSchema.safeParse(raw)

  if (!parsed.success) {
    throw ForestaError.validation(
      'Invalid action response from LLM',
      parsed.error.errors
    )
  }

  const data = parsed.data

  // Validate lieu_fin is accessible
  if (!lieuxAccessibles.includes(data.lieu_fin)) {
    throw ForestaError.validation(
      `Invalid lieu_fin: ${data.lieu_fin}. Accessible: ${lieuxAccessibles.join(', ')}`
    )
  }

  // Validate cible if present
  if (data.cible && !personnagesPresents.includes(data.cible)) {
    // Cible invalide = set to null (soft fail)
    data.cible = null
  }

  return {
    ...data,
    source: 'llm'
  }
}

/**
 * Validate and transform destin response
 */
export function validateDestinResponse(raw: unknown): Destin {
  const parsed = DestinResponseSchema.safeParse(raw)

  if (!parsed.success) {
    throw ForestaError.validation(
      'Invalid destin response from LLM',
      parsed.error.errors
    )
  }

  const data = parsed.data

  // Sort paliers by jour_cible
  const paliers: Palier[] = data.paliers
    .sort((a, b) => a.jour_cible - b.jour_cible)
    .map(p => ({
      jour_cible: p.jour_cible,
      description: p.description,
      atteint: false // Always false for new destiny
    }))

  return {
    fin_ecrite: data.fin_ecrite,
    inclination_actuelle: data.inclination_actuelle,
    paliers,
    derniere_recalcul: null
  }
}

/**
 * Validate resume response
 */
export function validateResumeResponse(raw: unknown): string {
  const parsed = ResumeResponseSchema.safeParse(raw)

  if (!parsed.success) {
    throw ForestaError.validation(
      'Invalid resume response from LLM',
      parsed.error.errors
    )
  }

  return parsed.data.resume
}

// ============================================
// SAFE PARSE HELPERS
// ============================================

/**
 * Try to parse JSON from potentially malformed LLM output
 */
export function safeParseJson(text: string): unknown {
  // Clean markdown code blocks
  let cleaned = text.trim()

  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }

  cleaned = cleaned.trim()

  // Try to extract JSON object if wrapped in text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    cleaned = jsonMatch[0]
  }

  try {
    return JSON.parse(cleaned)
  } catch {
    throw ForestaError.validation('Failed to parse JSON from LLM response', { raw: text })
  }
}

/**
 * Validate action with fallback on failure
 */
export function validateActionWithFallback(
  raw: unknown,
  lieuxAccessibles: string[],
  personnagesPresents: string[],
  personnageNom: string,
  currentPosition: string
): ActionResult {
  try {
    return validateActionResponse(raw, lieuxAccessibles, personnagesPresents)
  } catch (error) {
    // Return safe fallback
    console.warn(`Validation failed for ${personnageNom}, using fallback:`, error)

    return {
      action: 'rester',
      lieu_fin: currentPosition,
      cible: null,
      narration: `${personnageNom} reste sur place, indécis.`,
      source: 'template'
    }
  }
}
