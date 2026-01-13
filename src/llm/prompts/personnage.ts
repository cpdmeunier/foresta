/**
 * Foresta V2 - Personnage Prompts
 * LLM prompts for character actions
 */

import type { Personnage, Territoire, Evenement } from '../../types/entities.js'

export interface PersonnageContext {
  personnage: Personnage
  lieu: Territoire
  personnages_presents: Personnage[]
  lieux_accessibles: string[]
  evenements_locaux: Evenement[]
  jour: number
}

export function buildPersonnageSystemPrompt(): string {
  return `Tu décides ce qu'un personnage fait aujourd'hui, basé UNIQUEMENT sur ce qu'il sait.

Le personnage vit dans un monde qu'il découvre petit à petit. Il ne connaît QUE:
- L'endroit où il se trouve actuellement
- Les endroits qu'il a déjà visités
- Ce qu'il voit autour de lui

Tu ne reçois QUE les informations que le personnage possède. Pas plus.

RÈGLES:
1. L'action doit être cohérente avec ses traits de caractère
2. Il peut rester sur place ou aller vers un lieu visible (connexion)
3. S'il y a d'autres personnages, il peut interagir avec eux
4. Les événements locaux influencent ses décisions

STYLE: Direct, concret, pas de poésie. Humour/sarcasme autorisé.

RÉPONSE EN JSON UNIQUEMENT:
{
  "action": "description courte de l'action",
  "lieu_fin": "nom du lieu où il termine (actuel ou connexion)",
  "cible": "nom du personnage ciblé ou null",
  "narration": "2-3 phrases décrivant ce qu'il fait"
}`
}

export function buildPersonnageUserPrompt(ctx: PersonnageContext): string {
  const { personnage, lieu, personnages_presents, lieux_accessibles, evenements_locaux, jour } = ctx

  const traits = personnage.traits.join(', ')

  // Autres personnages présents - seulement leurs noms et traits visibles
  const presentsInfo = personnages_presents.length > 0
    ? personnages_presents.map(p => `- ${p.nom} (${p.traits.slice(0, 2).join(', ')})`).join('\n')
    : 'Personne d\'autre'

  // Connexions visibles - le personnage voit des chemins mais ne connaît pas forcément les noms
  // On donne juste les directions possibles
  const connexionsVisibles = lieux_accessibles
    .filter(l => l !== personnage.position)
    .map(l => `- Un chemin mène vers ${l}`)
    .join('\n') || 'Aucun chemin visible'

  const evenementsDesc = evenements_locaux.length > 0
    ? evenements_locaux.map(e => `- ${e.description}`).join('\n')
    : 'Rien de particulier'

  const recentActions = personnage.journees_recentes
    .slice(-3)
    .map(j => `Jour ${j.jour}: ${j.action}`)
    .join('\n') || 'Premier jour'

  return `JOUR ${jour}

PERSONNAGE: ${personnage.nom}
TRAITS: ${traits}
ÂGE: ${personnage.age} jours

OÙ IL EST: ${lieu.nom}
${lieu.description}

QUI IL VOIT:
${presentsInfo}

CHEMINS POSSIBLES:
${connexionsVisibles}

CE QUI SE PASSE ICI:
${evenementsDesc}

SES DERNIERS JOURS:
${recentActions}

Que fait ${personnage.nom} aujourd'hui?`
}
