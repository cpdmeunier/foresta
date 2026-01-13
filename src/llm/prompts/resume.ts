/**
 * Foresta V2 - Resume Prompts
 * LLM prompts for daily summaries
 */

import type { Personnage, ActionResult } from '../../types/entities.js'

export interface ResumeDayContext {
  jour: number
  actions: Array<{
    personnage: Personnage
    action: ActionResult
  }>
  evenements_actifs: number
  degraded: boolean
}

export function buildResumeSystemPrompt(): string {
  return `Tu rédiges un résumé du jour. Style: journal intime, brut, direct.

INTERDIT:
- Poésie, métaphores fleuries
- Mots pompeux (écarlate, ancestral, murmure, voile)
- Ton poli et générique

OBLIGATOIRE:
- Direct et concret
- 1 phrase par personnage qui a agi
- Humour/sarcasme autorisé si pertinent

RÉPONSE EN JSON UNIQUEMENT:
{
  "resume": "Résumé brut du jour"
}`
}

export function buildResumeUserPrompt(ctx: ResumeDayContext): string {
  const { jour, actions, evenements_actifs, degraded } = ctx

  const actionsDesc = actions
    .map(({ personnage, action }) => {
      return `- ${personnage.nom} (${personnage.traits.slice(0, 2).join(', ')}): ${action.narration}`
    })
    .join('\n') || 'Aucune action ce jour'

  const degradedNote = degraded
    ? '\n⚠️ Note: Ce jour a été simulé en mode dégradé (LLM indisponible).'
    : ''

  return `JOUR ${jour} À FORESTA

ACTIONS DES HABITANTS:
${actionsDesc}

ÉVÉNEMENTS ACTIFS: ${evenements_actifs}
${degradedNote}

Rédige le résumé de ce jour pour la chronique de Foresta.`
}
