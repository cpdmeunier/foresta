/**
 * Foresta V2 - Destiny Tests
 */

import { describe, it, expect } from 'vitest'
import { checkDeviation, shouldRecalculateDestiny, checkPalierReached } from './destiny.js'
import type { Personnage, Destin, JourneeResume } from '../types/entities.js'

// Helper to create test personnage
function createTestPersonnage(overrides: Partial<Personnage> = {}): Personnage {
  return {
    id: 'test-id',
    nom: 'TestCharacter',
    traits: ['curieux', 'prudent'],
    position: 'heda',
    age: 30,
    vivant: true,
    destin: null,
    journees_recentes: [],
    relations: [],
    in_conversation: false,
    in_conversation_since: null,
    derniere_action: null,
    jour_derniere_action: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }
}

function createTestDestin(overrides: Partial<Destin> = {}): Destin {
  return {
    fin_ecrite: 'Test destiny',
    inclination_actuelle: 'cherche compagnie',
    paliers: [
      { jour_cible: 25, description: 'First milestone', atteint: false },
      { jour_cible: 50, description: 'Second milestone', atteint: false }
    ],
    derniere_recalcul: null,
    ...overrides
  }
}

describe('checkDeviation', () => {
  it('should return 0 for personnage without destiny', () => {
    const personnage = createTestPersonnage()
    expect(checkDeviation(personnage)).toBe(0)
  })

  it('should return 0 for personnage with few recent days', () => {
    const personnage = createTestPersonnage({
      destin: createTestDestin(),
      journees_recentes: [
        { jour: 1, action: 'test', lieu: 'heda', interactions: [] }
      ]
    })
    expect(checkDeviation(personnage)).toBe(0)
  })

  it('should detect deviation for social inclination when alone', () => {
    const journees: JourneeResume[] = [
      { jour: 1, action: 'rester', lieu: 'heda', interactions: [] },
      { jour: 2, action: 'explorer', lieu: 'veda', interactions: [] },
      { jour: 3, action: 'manger', lieu: 'heda', interactions: [] },
      { jour: 4, action: 'dormir', lieu: 'heda', interactions: [] },
      { jour: 5, action: 'rester', lieu: 'heda', interactions: [] }
    ]

    const personnage = createTestPersonnage({
      destin: createTestDestin({ inclination_actuelle: 'cherche compagnie' }),
      journees_recentes: journees
    })

    const deviation = checkDeviation(personnage)
    expect(deviation).toBeGreaterThan(0)
    expect(deviation).toBeLessThanOrEqual(1)
  })

  it('should not detect deviation when inclination is met', () => {
    const journees: JourneeResume[] = [
      { jour: 1, action: 'parler', lieu: 'heda', interactions: ['Luna'] },
      { jour: 2, action: 'rencontrer', lieu: 'heda', interactions: ['Roga'] },
      { jour: 3, action: 'discuter', lieu: 'heda', interactions: ['Luna', 'Roga'] }
    ]

    const personnage = createTestPersonnage({
      destin: createTestDestin({ inclination_actuelle: 'cherche compagnie' }),
      journees_recentes: journees
    })

    const deviation = checkDeviation(personnage)
    expect(deviation).toBe(0)
  })
})

describe('shouldRecalculateDestiny', () => {
  it('should not recalculate without destiny', () => {
    const personnage = createTestPersonnage()
    const result = shouldRecalculateDestiny(personnage, 30)
    expect(result.shouldRecalcul).toBe(false)
  })

  it('should not recalculate during cooldown', () => {
    const personnage = createTestPersonnage({
      destin: createTestDestin({ derniere_recalcul: 28 })
    })
    const result = shouldRecalculateDestiny(personnage, 30)
    expect(result.shouldRecalcul).toBe(false)
  })

  it('should detect missed palier', () => {
    const personnage = createTestPersonnage({
      destin: createTestDestin({
        paliers: [
          { jour_cible: 25, description: 'Missed', atteint: false }
        ]
      })
    })

    // Day 31 = past jour_cible (25) + tolerance (5)
    const result = shouldRecalculateDestiny(personnage, 31)
    expect(result.shouldRecalcul).toBe(true)
    expect(result.raison).toBe('palier_manque')
  })

  it('should not trigger for palier in tolerance window', () => {
    const personnage = createTestPersonnage({
      destin: createTestDestin({
        paliers: [
          { jour_cible: 25, description: 'In window', atteint: false }
        ]
      })
    })

    // Day 28 = within tolerance (25 + 5 = 30)
    const result = shouldRecalculateDestiny(personnage, 28)
    expect(result.shouldRecalcul).toBe(false)
  })
})

describe('checkPalierReached', () => {
  it('should return false without destiny', () => {
    const personnage = createTestPersonnage()
    expect(checkPalierReached(personnage, 25, 'test', 'heda')).toBe(false)
  })

  it('should return false if not in tolerance window', () => {
    const personnage = createTestPersonnage({
      destin: createTestDestin({
        paliers: [
          { jour_cible: 50, description: 'rencontre at luna', atteint: false }
        ]
      })
    })

    // Day 25 is far from jour_cible 50
    expect(checkPalierReached(personnage, 25, 'rencontre', 'luna')).toBe(false)
  })

  it('should match on lieu keyword', () => {
    const personnage = createTestPersonnage({
      destin: createTestDestin({
        paliers: [
          { jour_cible: 25, description: 'Arriver à luna', atteint: false }
        ]
      })
    })

    // Day 25 in window, lieu 'luna' matches description
    expect(checkPalierReached(personnage, 25, 'voyager', 'luna')).toBe(true)
  })

  it('should not match already reached palier', () => {
    const personnage = createTestPersonnage({
      destin: createTestDestin({
        paliers: [
          { jour_cible: 25, description: 'rencontre at luna', atteint: true }
        ]
      })
    })

    expect(checkPalierReached(personnage, 25, 'rencontre', 'luna')).toBe(false)
  })
})
