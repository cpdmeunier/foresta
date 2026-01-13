/**
 * Foresta V2 - Destin Prompts
 * LLM prompts for destiny creation and recalculation
 */

import type { Personnage } from '../../types/entities.js'

export function buildDestinCreationSystemPrompt(): string {
  return `Tu crées le destin d'un personnage qui vient de naître.

Le personnage vivra environ 100 jours. Son destin comprend:
- Une fin écrite (comment sa vie se terminera, 1-2 phrases)
- 3 paliers (moments clés vers les jours 25, 50, 75)
- Une inclination actuelle (ce vers quoi il tend maintenant)

Les paliers doivent être:
- Cohérents avec les traits du personnage
- Vagues pour permettre de l'interprétation
- Liés à des découvertes, rencontres ou épreuves

Le personnage ne connaît PAS son destin. C'est toi qui le vois.

STYLE: Direct, concret, pas de poésie.

RÉPONSE EN JSON UNIQUEMENT:
{
  "fin_ecrite": "description de la fin",
  "paliers": [
    { "jour_cible": 25, "description": "premier palier", "atteint": false },
    { "jour_cible": 50, "description": "deuxième palier", "atteint": false },
    { "jour_cible": 75, "description": "troisième palier", "atteint": false }
  ],
  "inclination_actuelle": "tendance actuelle"
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
  return `Un personnage a dévié de son destin initial. Tu recalcules son destin.

Tu dois tenir compte:
- De ses actions récentes (ce qu'il a vraiment fait)
- De ses traits (qui restent constants)
- Des paliers déjà atteints

Le nouveau destin doit:
- Intégrer les déviations comme partie de l'histoire
- Rester cohérent avec les traits
- Proposer de nouveaux paliers réalistes

STYLE: Direct, concret, pas de poésie.

RÉPONSE EN JSON UNIQUEMENT:
{
  "fin_ecrite": "nouvelle fin",
  "paliers": [
    { "jour_cible": XX, "description": "palier", "atteint": false }
  ],
  "inclination_actuelle": "nouvelle tendance"
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
