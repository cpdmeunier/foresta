/**
 * Foresta V2 - Destin Prompts
 * LLM prompts for destiny creation and recalculation
 */

import type { Personnage } from '../../types/entities.js'

export function buildDestinCreationSystemPrompt(): string {
  return `Tu es l'Oracle de Foresta, celui qui tisse les destins des habitants.

Quand un personnage naît, tu lui attribues un destin:
- Une fin écrite (comment sa vie se terminera, en 1-2 phrases)
- 3-4 paliers (moments clés de sa vie, avec le jour approximatif)
- Une inclination actuelle (ce vers quoi le personnage tend maintenant)

Les paliers doivent être:
- Espacés de ~25 jours (durée de vie = 100 jours)
- Cohérents avec les traits du personnage
- Assez vagues pour permettre de l'interprétation

RÉPONSE EN JSON UNIQUEMENT:
{
  "fin_ecrite": "description de la fin du personnage",
  "paliers": [
    { "jour_cible": 25, "description": "ce qui doit arriver", "atteint": false },
    { "jour_cible": 50, "description": "ce qui doit arriver", "atteint": false },
    { "jour_cible": 75, "description": "ce qui doit arriver", "atteint": false }
  ],
  "inclination_actuelle": "tendance actuelle du personnage"
}`
}

export function buildDestinCreationUserPrompt(personnage: Personnage): string {
  const traits = personnage.traits.join(', ')

  return `NOUVEAU PERSONNAGE: ${personnage.nom}

TRAITS: ${traits}
LIEU DE NAISSANCE: ${personnage.position}

Tisse le destin de ${personnage.nom}.`
}

export function buildDestinRecalculSystemPrompt(): string {
  return `Tu es l'Oracle de Foresta. Un personnage a dévié de son destin initial.

Tu dois recalculer son destin en tenant compte:
- De ses actions récentes (ce qu'il a vraiment fait)
- De ses traits (qui restent constants)
- Du chemin parcouru (les paliers déjà atteints)

Le nouveau destin doit:
- Intégrer les déviations comme partie de l'histoire
- Rester cohérent avec les traits
- Proposer de nouveaux paliers réalistes

RÉPONSE EN JSON UNIQUEMENT:
{
  "fin_ecrite": "nouvelle fin du personnage",
  "paliers": [
    { "jour_cible": XX, "description": "ce qui doit arriver", "atteint": false }
  ],
  "inclination_actuelle": "nouvelle tendance du personnage"
}`
}

export function buildDestinRecalculUserPrompt(
  personnage: Personnage,
  raison: 'palier_manque' | 'deviation_seuil'
): string {
  const traits = personnage.traits.join(', ')
  const destin = personnage.destin

  const paliersInfo = destin?.paliers
    .map(p => `- Jour ${p.jour_cible}: "${p.description}" ${p.atteint ? '✓ ATTEINT' : '✗ non atteint'}`)
    .join('\n') || 'Aucun palier'

  const recentActions = personnage.journees_recentes
    .map(j => `Jour ${j.jour}: ${j.action} à ${j.lieu}`)
    .join('\n') || 'Aucune action récente'

  const raisonText = raison === 'palier_manque'
    ? 'Un palier important a été manqué'
    : 'Le personnage a dévié significativement de son inclination'

  return `RECALCUL DE DESTIN - ${personnage.nom}

RAISON: ${raisonText}

TRAITS: ${traits}
ÂGE: ${personnage.age} jours
POSITION: ${personnage.position}

ANCIEN DESTIN:
Fin écrite: "${destin?.fin_ecrite || 'inconnu'}"
Inclination: "${destin?.inclination_actuelle || 'inconnue'}"

PALIERS:
${paliersInfo}

ACTIONS RÉCENTES:
${recentActions}

Recalcule le destin de ${personnage.nom} en intégrant ses actions.`
}
