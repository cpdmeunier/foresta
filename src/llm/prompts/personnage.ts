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

GÉOGRAPHIE (pour toi, le narrateur):
- HEDA: Forêt tranquille et sûre. Point de départ.
- VEDA: Vallée aux cratères toxiques. Rend fou.
- LUNA: Montagnes avec monstres. Danger mortel.
- ROGA: Désert aride. Survie difficile.
- MUNA: Terres glacées. Froid mortel.

IMPORTANT - CONNAISSANCE DES PERSONNAGES:
- Un personnage NE CONNAÎT QUE les territoires qu'il a visités
- Au départ, il ne connaît AUCUN nom de lieu - il découvre tout
- Il appelle les lieux par ce qu'il voit ("la forêt", "ces montagnes")
- Il apprend les noms et dangers en explorant ou en parlant aux autres
- S'il n'a jamais quitté Heda, il ne sait même pas que d'autres territoires existent

Chaque personnage a:
- Des traits de caractère qui influencent ses décisions
- Un destin écrit avec des paliers à atteindre
- Une liste de territoires connus (knownRegions)
- Une mémoire des derniers jours

RÈGLES:
1. L'action doit être cohérente avec les traits du personnage
2. Le lieu de fin doit être accessible (lieu actuel ou connexion)
3. Le personnage ne peut PAS mentionner un lieu qu'il n'a pas visité
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

  // Calculate known regions from journees_recentes + current position
  const visitedLieux = new Set<string>([personnage.position])
  for (const j of personnage.journees_recentes) {
    visitedLieux.add(j.lieu)
  }
  const lieuxConnus = Array.from(visitedLieux).join(', ')

  const destinyHint = personnage.destin
    ? `Destin (pour le narrateur): "${personnage.destin.fin_ecrite}". Inclination: "${personnage.destin.inclination_actuelle}"`
    : 'Pas encore de destin'

  const recentActions = personnage.journees_recentes
    .slice(-3)
    .map(j => `Jour ${j.jour}: ${j.action} à ${j.lieu}`)
    .join('\n') || 'Aucune action récente'

  return `JOUR ${jour} - PERSONNAGE: ${personnage.nom}

TRAITS: ${traits}
ÂGE: ${personnage.age} jours
POSITION ACTUELLE: ${lieu.nom} - ${lieu.description}

TERRITOIRES CONNUS PAR LE PERSONNAGE: ${lieuxConnus}
(Il ne connaît PAS les autres territoires - il ne sait même pas qu'ils existent)

PRÉSENTS: ${presentsNames}
LIEUX ACCESSIBLES (pour le narrateur): ${accessibles}

ÉVÉNEMENTS LOCAUX:
${evenementsDesc}

${destinyHint}

ACTIONS RÉCENTES:
${recentActions}

Quelle action ${personnage.nom} fait-il aujourd'hui?`
}
