/**
 * Foresta V2 - Action Templates
 * Fallback actions when LLM is unavailable (30% of actions)
 */

import type { Personnage, ActionResult } from '../types/entities.js'

// ============================================
// TEMPLATE TYPES
// ============================================
type TemplateType = 'manger' | 'dormir' | 'rester' | 'explorer' | 'socialiser'

interface TemplateConfig {
  type: TemplateType
  weight: number
  narrations: string[]
}

// ============================================
// TEMPLATES DATA
// ============================================
const TEMPLATES: TemplateConfig[] = [
  {
    type: 'manger',
    weight: 20,
    narrations: [
      '{nom} cherche de la nourriture dans les environs.',
      '{nom} se sustente avec ce que la nature lui offre.',
      '{nom} prend un moment pour manger tranquillement.'
    ]
  },
  {
    type: 'dormir',
    weight: 15,
    narrations: [
      '{nom} se repose à l\'abri.',
      '{nom} trouve un coin tranquille pour dormir.',
      '{nom} récupère ses forces en sommeil.'
    ]
  },
  {
    type: 'rester',
    weight: 25,
    narrations: [
      '{nom} reste sur place, observant le monde.',
      '{nom} médite en silence.',
      '{nom} contemple les environs sans bouger.'
    ]
  },
  {
    type: 'explorer',
    weight: 25,
    narrations: [
      '{nom} explore les alentours avec curiosité.',
      '{nom} découvre de nouveaux recoins.',
      '{nom} parcourt le territoire en quête de nouveautés.'
    ]
  },
  {
    type: 'socialiser',
    weight: 15,
    narrations: [
      '{nom} cherche la compagnie d\'autres habitants.',
      '{nom} tente d\'établir un contact.',
      '{nom} observe les autres de loin.'
    ]
  }
]

// ============================================
// TRAIT-BASED WEIGHT MODIFIERS
// ============================================
const TRAIT_MODIFIERS: Record<string, Partial<Record<TemplateType, number>>> = {
  curieux: { explorer: 15, rester: -10 },
  prudent: { rester: 15, explorer: -10 },
  sociable: { socialiser: 20, rester: -10 },
  solitaire: { rester: 15, socialiser: -15 },
  paresseux: { dormir: 20, explorer: -15 },
  energique: { explorer: 15, dormir: -10 },
  gourmand: { manger: 20 },
  contemplatif: { rester: 20, explorer: -10 }
}

// ============================================
// TEMPLATE SELECTION
// ============================================
export function selectTemplate(personnage: Personnage): TemplateConfig {
  // Calculate weights based on traits
  const weights = new Map<TemplateType, number>()

  for (const template of TEMPLATES) {
    weights.set(template.type, template.weight)
  }

  // Apply trait modifiers
  for (const trait of personnage.traits) {
    const modifiers = TRAIT_MODIFIERS[trait.toLowerCase()]
    if (modifiers) {
      for (const [type, modifier] of Object.entries(modifiers)) {
        const current = weights.get(type as TemplateType) || 0
        weights.set(type as TemplateType, Math.max(0, current + modifier))
      }
    }
  }

  // Calculate total weight
  const totalWeight = Array.from(weights.values()).reduce((a, b) => a + b, 0)

  // Random selection based on weights
  let random = Math.random() * totalWeight
  for (const template of TEMPLATES) {
    const weight = weights.get(template.type) || 0
    if (random < weight) {
      return template
    }
    random -= weight
  }

  // Fallback
  return TEMPLATES[0]
}

// ============================================
// TEMPLATE EXECUTION
// ============================================
export function executeTemplate(
  personnage: Personnage,
  lieuxAccessibles: string[]
): ActionResult {
  const template = selectTemplate(personnage)

  // Select random narration
  const narrationTemplate = template.narrations[
    Math.floor(Math.random() * template.narrations.length)
  ]
  const narration = narrationTemplate.replace('{nom}', personnage.nom)

  // Determine final location
  let lieuFin = personnage.position

  // Explorer might move
  if (template.type === 'explorer' && Math.random() > 0.5) {
    const otherLieux = lieuxAccessibles.filter(l => l !== personnage.position)
    if (otherLieux.length > 0) {
      lieuFin = otherLieux[Math.floor(Math.random() * otherLieux.length)]
    }
  }

  return {
    action: template.type,
    lieu_fin: lieuFin,
    cible: null,
    narration,
    source: 'template'
  }
}

// ============================================
// SHOULD USE TEMPLATE?
// ============================================
export function shouldUseTemplate(personnage: Personnage): boolean {
  // 30% of actions use templates
  // More likely for simpler situations
  const base = 0.3

  // Increase if no destiny (simpler character)
  const destinyBonus = personnage.destin ? 0 : 0.1

  // Increase if low age (less history)
  const ageBonus = personnage.age < 10 ? 0.1 : 0

  return Math.random() < (base + destinyBonus + ageBonus)
}
