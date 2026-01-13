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
  return `Tu es le narrateur de Foresta, une petite planète habitée par des animaux.

GÉOGRAPHIE DE FORESTA:
- HEDA: Forêt tranquille et sûre. Point de départ de tous.
- VEDA: Vallée aux cratères. Des gaz toxiques s'en échappent. Rester trop longtemps rend fou.
- LUNA: Montagnes et grottes. Monstres sauvages. Danger de mort.
- ROGA: Désert chaud et aride. Survie difficile.
- MUNA: Terres glacées. Neige et froid mortel.

Les personnages naissent à Heda et découvrent les autres territoires en explorant.

Chaque personnage a:
- Des traits de caractère qui influencent ses décisions
- Un destin écrit avec des paliers à atteindre
- Des relations avec d'autres personnages
- Une mémoire des derniers jours

Tu dois décider de l'action du jour pour un personnage donné.

RÈGLES:
1. L'action doit être cohérente avec les traits du personnage
2. Le lieu de fin doit être accessible (lieu actuel ou connexion)
3. Si des personnages sont présents, les interactions sont possibles
4. Les événements locaux influencent les décisions
5. Le destin guide subtilement mais n'impose pas

STYLE: Direct, concret, pas de poésie. Humour/sarcasme autorisé.

RÉPONSE EN JSON UNIQUEMENT:
{
  "action": "description courte de l'action",
  "lieu_fin": "nom du territoire où le personnage finit",
  "cible": "nom du personnage ciblé ou null",
  "narration": "2-3 phrases narratives décrivant l'action"
}`
}

export function buildPersonnageUserPrompt(ctx: PersonnageContext): string {
  const { personnage, lieu, personnages_presents, lieux_accessibles, evenements_locaux, jour } = ctx

  const traits = personnage.traits.join(', ')
  const presentsNames = personnages_presents.map(p => p.nom).join(', ') || 'personne'
  const accessibles = lieux_accessibles.join(', ')
  const evenementsDesc = evenements_locaux.map(e => `- ${e.type}: ${e.description}`).join('\n') || 'aucun'

  const destinyHint = personnage.destin
    ? `Destin: "${personnage.destin.fin_ecrite}". Inclination actuelle: "${personnage.destin.inclination_actuelle}"`
    : 'Pas encore de destin'

  const recentActions = personnage.journees_recentes
    .slice(-3)
    .map(j => `Jour ${j.jour}: ${j.action} à ${j.lieu}`)
    .join('\n') || 'Aucune action récente'

  return `JOUR ${jour} - PERSONNAGE: ${personnage.nom}

TRAITS: ${traits}
ÂGE: ${personnage.age} jours
POSITION ACTUELLE: ${lieu.nom} - ${lieu.description}

PRÉSENTS: ${presentsNames}
LIEUX ACCESSIBLES: ${accessibles}

ÉVÉNEMENTS LOCAUX:
${evenementsDesc}

${destinyHint}

ACTIONS RÉCENTES:
${recentActions}

Quelle action ${personnage.nom} fait-il aujourd'hui?`
}
