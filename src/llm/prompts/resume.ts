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
  return `Tu es le chroniqueur de Foresta. Tu rédiges le résumé quotidien du monde.

Le résumé doit:
- Être poétique mais concis (3-5 phrases)
- Capturer l'essence des événements du jour
- Mentionner les personnages qui ont agi
- Évoquer l'atmosphère générale

RÉPONSE EN JSON UNIQUEMENT:
{
  "resume": "Le résumé du jour en 3-5 phrases"
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
