/**
 * Foresta V2 - Actions Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { selectTemplate, executeTemplate, shouldUseTemplate } from '../llm/templates.js'
import type { Personnage } from '../types/entities.js'

// Helper to create test personnage
function createTestPersonnage(overrides: Partial<Personnage> = {}): Personnage {
  return {
    id: 'test-id',
    nom: 'TestCharacter',
    traits: ['curieux'],
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

describe('selectTemplate', () => {
  it('should return a valid template', () => {
    const personnage = createTestPersonnage()
    const template = selectTemplate(personnage)

    expect(template).toBeDefined()
    expect(template.type).toBeDefined()
    expect(template.narrations.length).toBeGreaterThan(0)
  })

  it('should favor explorer for curieux trait', () => {
    const personnage = createTestPersonnage({ traits: ['curieux'] })

    // Run multiple times to check weighted selection
    const results = new Map<string, number>()
    for (let i = 0; i < 100; i++) {
      const template = selectTemplate(personnage)
      results.set(template.type, (results.get(template.type) || 0) + 1)
    }

    // Explorer should be more common
    const explorerCount = results.get('explorer') || 0
    const resterCount = results.get('rester') || 0

    // With +15 explorer and -10 rester for curieux, explorer should win
    expect(explorerCount).toBeGreaterThan(resterCount)
  })

  it('should favor dormir for paresseux trait', () => {
    const personnage = createTestPersonnage({ traits: ['paresseux'] })

    const results = new Map<string, number>()
    for (let i = 0; i < 100; i++) {
      const template = selectTemplate(personnage)
      results.set(template.type, (results.get(template.type) || 0) + 1)
    }

    const dormirCount = results.get('dormir') || 0
    expect(dormirCount).toBeGreaterThan(10) // Should appear more often
  })
})

describe('executeTemplate', () => {
  it('should return a valid ActionResult', () => {
    const personnage = createTestPersonnage()
    const lieuxAccessibles = ['heda', 'veda', 'luna']

    const result = executeTemplate(personnage, lieuxAccessibles)

    expect(result).toBeDefined()
    expect(result.action).toBeDefined()
    expect(result.source).toBe('template')
    expect(lieuxAccessibles).toContain(result.lieu_fin)
    expect(result.narration).toContain(personnage.nom)
  })

  it('should keep current position for non-explorer actions', () => {
    // Mock Math.random to always return high value (rester action)
    vi.spyOn(Math, 'random').mockReturnValue(0.99)

    const personnage = createTestPersonnage({ traits: ['contemplatif'] })
    const lieuxAccessibles = ['heda', 'veda']

    const result = executeTemplate(personnage, lieuxAccessibles)

    // Should stay in place for rester
    if (result.action === 'rester') {
      expect(result.lieu_fin).toBe(personnage.position)
    }

    vi.restoreAllMocks()
  })
})

describe('shouldUseTemplate', () => {
  it('should have base probability around 30%', () => {
    const personnage = createTestPersonnage({
      destin: { fin_ecrite: 'test', paliers: [], inclination_actuelle: 'test', derniere_recalcul: null },
      age: 50
    })

    let templateCount = 0
    const iterations = 1000

    for (let i = 0; i < iterations; i++) {
      if (shouldUseTemplate(personnage)) {
        templateCount++
      }
    }

    const percentage = templateCount / iterations
    // Should be around 30% (0.3), allow margin
    expect(percentage).toBeGreaterThan(0.2)
    expect(percentage).toBeLessThan(0.5)
  })

  it('should increase probability for young characters', () => {
    const youngPersonnage = createTestPersonnage({ age: 5 })
    const oldPersonnage = createTestPersonnage({ age: 50 })

    let youngTemplateCount = 0
    let oldTemplateCount = 0
    const iterations = 1000

    for (let i = 0; i < iterations; i++) {
      if (shouldUseTemplate(youngPersonnage)) youngTemplateCount++
      if (shouldUseTemplate(oldPersonnage)) oldTemplateCount++
    }

    // Young should use templates more often
    expect(youngTemplateCount).toBeGreaterThan(oldTemplateCount)
  })
})
