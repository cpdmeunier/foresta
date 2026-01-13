/**
 * Foresta V2 - Character Actions
 * Context generation, day execution, outcome application
 */

import type {
  Personnage,
  ActionResult,
  JourneeResume,
  Relation
} from '../types/entities.js'
import type { ContextePersonnage } from '../types/orchestrator.js'
import { getPersonnagesAtPosition, updatePersonnageAction, addJourneeRecente, updateRelations, getPersonnageById } from '../db/queries/personnages.js'
import { getLieuxAccessibles, getTerritoireByNom } from '../db/queries/territoires.js'
import { getEvenementsAtZone } from '../db/queries/evenements.js'
import { callLLMJson } from '../llm/client.js'
import { buildPersonnageSystemPrompt, buildPersonnageUserPrompt } from '../llm/prompts/personnage.js'
import { shouldUseTemplate, executeTemplate } from '../llm/templates.js'
import { validateActionWithFallback } from './validation.js'

// ============================================
// GENERATE CONTEXT
// ============================================
export async function generateContext(
  personnage: Personnage,
  _jour: number
): Promise<ContextePersonnage> {
  // Get current territory
  const lieu = await getTerritoireByNom(personnage.position)

  // Get other characters at same position
  const allAtPosition = await getPersonnagesAtPosition(personnage.position)
  const personnages_presents = allAtPosition.filter(p => p.id !== personnage.id)

  // Get accessible locations
  const lieux_accessibles = await getLieuxAccessibles(personnage.position)

  // Get local events
  const evenements_locaux = await getEvenementsAtZone(personnage.position)

  return {
    personnage,
    lieu,
    personnages_presents,
    lieux_accessibles,
    evenements_locaux
  }
}

// ============================================
// EXECUTE DAY (Template or LLM)
// ============================================
export async function executeDay(
  personnage: Personnage,
  contexte: ContextePersonnage,
  jour: number,
  forceDegraded: boolean = false
): Promise<ActionResult> {
  const { lieu, personnages_presents, lieux_accessibles } = contexte

  // Use template if degraded mode or random selection
  if (forceDegraded || shouldUseTemplate(personnage)) {
    return executeTemplate(personnage, lieux_accessibles)
  }

  // Use LLM
  try {
    const systemPrompt = buildPersonnageSystemPrompt()
    const userPrompt = buildPersonnageUserPrompt({
      personnage,
      lieu,
      personnages_presents,
      lieux_accessibles,
      evenements_locaux: contexte.evenements_locaux,
      jour
    })

    const response = await callLLMJson<unknown>(systemPrompt, userPrompt)

    // Validate response
    const personnagesNomsPresents = personnages_presents.map(p => p.nom)

    return validateActionWithFallback(
      response,
      lieux_accessibles,
      personnagesNomsPresents,
      personnage.nom,
      personnage.position
    )
  } catch (error) {
    console.warn(`LLM failed for ${personnage.nom}, using template:`, error)
    return executeTemplate(personnage, lieux_accessibles)
  }
}

// ============================================
// APPLY OUTCOME
// ============================================
export async function applyOutcome(
  personnage: Personnage,
  action: ActionResult,
  jour: number
): Promise<Personnage> {
  // Update personnage with action
  const updated = await updatePersonnageAction(personnage.id, action, jour)

  // Create journee resume
  const journee: JourneeResume = {
    jour,
    action: action.action,
    lieu: action.lieu_fin,
    interactions: action.cible ? [action.cible] : []
  }

  // Add to recent days
  await addJourneeRecente(personnage.id, journee)

  return updated
}

// ============================================
// UPDATE RELATIONS FROM INTERACTION
// ============================================
export async function updateRelationsFromInteraction(
  personnageA: Personnage,
  personnageB: Personnage
): Promise<void> {
  // Update both relations atomically by always fetching fresh data
  await updatePersonnageRelationAtomic(personnageA.id, personnageB.id, personnageB.nom)
  await updatePersonnageRelationAtomic(personnageB.id, personnageA.id, personnageA.nom)
}

async function updatePersonnageRelationAtomic(
  sourceId: string,
  targetId: string,
  targetNom: string
): Promise<void> {
  // Always fetch fresh data to avoid race conditions
  const source = await getPersonnageById(sourceId)
  const relations = [...source.relations]

  const existingIndex = relations.findIndex(r => r.personnage_id === targetId)

  if (existingIndex >= 0) {
    // Increase intensity (cap at 1.0)
    relations[existingIndex] = {
      ...relations[existingIndex],
      intensite: Math.min(1.0, relations[existingIndex].intensite + 0.1)
    }

    // Upgrade type after 5+ interactions (intensity > 0.5)
    if (relations[existingIndex].intensite > 0.5 && relations[existingIndex].type === 'connaissance') {
      relations[existingIndex].type = 'ami'
    }
  } else {
    // Create new relation
    const newRelation: Relation = {
      personnage_id: targetId,
      personnage_nom: targetNom,
      type: 'connaissance',
      intensite: 0.3
    }
    relations.push(newRelation)
  }

  await updateRelations(sourceId, relations)
}

