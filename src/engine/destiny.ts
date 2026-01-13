/**
 * Foresta V2 - Destiny System
 * Creation, deviation checking, and recalculation
 */

import type { Personnage, Destin, JourneeResume } from '../types/entities.js'
import { updatePersonnageDestin } from '../db/queries/personnages.js'
import { callLLMJson } from '../llm/client.js'
import {
  buildDestinCreationSystemPrompt,
  buildDestinCreationUserPrompt,
  buildDestinRecalculSystemPrompt,
  buildDestinRecalculUserPrompt
} from '../llm/prompts/destin.js'
import { validateDestinResponse } from './validation.js'

// ============================================
// CONSTANTS
// ============================================
const PALIER_TOLERANCE = 5 // ±5 jours
const DEVIATION_THRESHOLD = 0.3 // 30%
const RECALCUL_COOLDOWN = 5 // 5 jours

// ============================================
// DEVIATION MAPPING (from tech spec)
// ============================================
interface DeviationRule {
  inclination_keywords: string[]
  contradiction_check: (actions: JourneeResume[], inclination: string) => number
}

const DEVIATION_RULES: DeviationRule[] = [
  {
    // Attrait vers un lieu spécifique
    inclination_keywords: ['attrait', 'vers', 'lieu'],
    contradiction_check: (actions, inclination) => {
      // Extract target location from inclination
      const match = inclination.match(/vers\s+(\w+)/i)
      if (!match) return 0

      const targetLieu = match[1].toLowerCase()
      const wentElsewhere = actions.some(a =>
        a.lieu.toLowerCase() !== targetLieu &&
        !inclination.toLowerCase().includes(a.lieu.toLowerCase())
      )

      return wentElsewhere ? 0.4 : 0
    }
  },
  {
    // Cherche la compagnie
    inclination_keywords: ['compagnie', 'social', 'cherche'],
    contradiction_check: (actions) => {
      // Count days alone (no interactions)
      const daysAlone = actions.filter(a => a.interactions.length === 0).length
      return daysAlone * 0.1 // +10% per day alone
    }
  },
  {
    // Évite le danger
    inclination_keywords: ['évite', 'danger', 'prudent', 'fuit'],
    contradiction_check: (actions) => {
      // Check if went to dangerous territories (simplified)
      const dangerZones = ['veda'] // marais = more dangerous
      const wentToDanger = actions.some(a => dangerZones.includes(a.lieu.toLowerCase()))
      return wentToDanger ? 0.5 : 0
    }
  },
  {
    // Repos, calme
    inclination_keywords: ['repos', 'calme', 'tranquille'],
    contradiction_check: (actions) => {
      // Check if explored a lot
      const uniqueLieux = new Set(actions.map(a => a.lieu)).size
      return uniqueLieux > 2 ? 0.2 : 0
    }
  }
]

// ============================================
// CREATE DESTINY
// ============================================
export async function createDestiny(personnage: Personnage): Promise<Destin> {
  const systemPrompt = buildDestinCreationSystemPrompt()
  const userPrompt = buildDestinCreationUserPrompt(personnage)

  const response = await callLLMJson<unknown>(systemPrompt, userPrompt)
  const destin = validateDestinResponse(response)

  // Save to DB
  await updatePersonnageDestin(personnage.id, destin)

  return destin
}

// ============================================
// CHECK DEVIATION
// ============================================
export function checkDeviation(personnage: Personnage): number {
  const { destin, journees_recentes } = personnage

  if (!destin || journees_recentes.length < 3) {
    return 0
  }

  const inclination = destin.inclination_actuelle.toLowerCase()
  const recentActions = journees_recentes.slice(-5) // Last 5 days

  let totalDeviation = 0

  for (const rule of DEVIATION_RULES) {
    // Check if this rule applies to the inclination
    const applies = rule.inclination_keywords.some(kw =>
      inclination.includes(kw.toLowerCase())
    )

    if (applies) {
      totalDeviation += rule.contradiction_check(recentActions, destin.inclination_actuelle)
    }
  }

  // Cap at 100%
  return Math.min(1, totalDeviation)
}

// ============================================
// SHOULD RECALCULATE
// ============================================
export interface RecalculCheck {
  shouldRecalcul: boolean
  raison: 'palier_manque' | 'deviation_seuil' | null
}

export function shouldRecalculateDestiny(
  personnage: Personnage,
  jourActuel: number
): RecalculCheck {
  const { destin } = personnage

  if (!destin) {
    return { shouldRecalcul: false, raison: null }
  }

  // Check cooldown
  if (destin.derniere_recalcul !== null) {
    const daysSinceRecalcul = jourActuel - destin.derniere_recalcul
    if (daysSinceRecalcul < RECALCUL_COOLDOWN) {
      return { shouldRecalcul: false, raison: null }
    }
  }

  // Check for missed paliers
  for (const palier of destin.paliers) {
    if (palier.atteint) continue

    // If we're past the tolerance window and palier not reached
    if (jourActuel > palier.jour_cible + PALIER_TOLERANCE) {
      return { shouldRecalcul: true, raison: 'palier_manque' }
    }
  }

  // Check deviation threshold
  const deviation = checkDeviation(personnage)
  if (deviation >= DEVIATION_THRESHOLD) {
    return { shouldRecalcul: true, raison: 'deviation_seuil' }
  }

  return { shouldRecalcul: false, raison: null }
}

// ============================================
// CHECK PALIER REACHED
// ============================================
export function checkPalierReached(
  personnage: Personnage,
  jourActuel: number,
  actionDuJour: string,
  lieu: string
): boolean {
  const { destin } = personnage

  if (!destin) return false

  for (const palier of destin.paliers) {
    if (palier.atteint) continue

    // Check if we're in the tolerance window
    const inWindow = (
      jourActuel >= palier.jour_cible - PALIER_TOLERANCE &&
      jourActuel <= palier.jour_cible + PALIER_TOLERANCE
    )

    if (!inWindow) continue

    // Simple heuristic: check if action/lieu match palier description
    const descLower = palier.description.toLowerCase()
    const actionLower = actionDuJour.toLowerCase()
    const lieuLower = lieu.toLowerCase()

    // Check for keyword matches
    const hasActionMatch = descLower.split(' ').some(word =>
      word.length > 3 && actionLower.includes(word)
    )
    const hasLieuMatch = descLower.includes(lieuLower)

    if (hasActionMatch || hasLieuMatch) {
      return true
    }
  }

  return false
}

// ============================================
// MARK PALIER REACHED
// ============================================
export async function markPalierReached(
  personnage: Personnage,
  _jourActuel: number,
  palierIndex: number
): Promise<Destin> {
  const { destin } = personnage

  if (!destin) {
    throw new Error('Cannot mark palier on personnage without destiny')
  }

  const updatedPaliers = [...destin.paliers]
  updatedPaliers[palierIndex] = {
    ...updatedPaliers[palierIndex],
    atteint: true
  }

  const updatedDestin: Destin = {
    ...destin,
    paliers: updatedPaliers
  }

  await updatePersonnageDestin(personnage.id, updatedDestin)
  return updatedDestin
}

// ============================================
// RECALCULATE DESTINY
// ============================================
export async function recalculateDestiny(
  personnage: Personnage,
  raison: 'palier_manque' | 'deviation_seuil',
  jourActuel: number
): Promise<Destin> {
  const systemPrompt = buildDestinRecalculSystemPrompt()
  const userPrompt = buildDestinRecalculUserPrompt(personnage, raison)

  const response = await callLLMJson<unknown>(systemPrompt, userPrompt)
  const newDestin = validateDestinResponse(response)

  // Preserve already reached paliers
  const oldDestin = personnage.destin
  if (oldDestin) {
    const reachedPaliers = oldDestin.paliers.filter(p => p.atteint)
    newDestin.paliers = [
      ...reachedPaliers,
      ...newDestin.paliers.filter(p => p.jour_cible > jourActuel)
    ].sort((a, b) => a.jour_cible - b.jour_cible)
  }

  // Set recalculation timestamp
  newDestin.derniere_recalcul = jourActuel

  // Save to DB
  await updatePersonnageDestin(personnage.id, newDestin)

  return newDestin
}
