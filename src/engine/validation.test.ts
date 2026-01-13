/**
 * Foresta V2 - Validation Tests
 */

import { describe, it, expect } from 'vitest'
import {
  validateActionResponse,
  validateDestinResponse,
  validateResumeResponse,
  safeParseJson,
  validateActionWithFallback
} from './validation.js'

describe('validateActionResponse', () => {
  const lieuxAccessibles = ['heda', 'veda', 'luna']
  const personnagesPresents = ['Luna', 'Roga']

  it('should validate a correct action response', () => {
    const raw = {
      action: 'explorer',
      lieu_fin: 'heda',
      cible: 'Luna',
      narration: 'Luna explore la forêt.'
    }

    const result = validateActionResponse(raw, lieuxAccessibles, personnagesPresents)

    expect(result.action).toBe('explorer')
    expect(result.lieu_fin).toBe('heda')
    expect(result.cible).toBe('Luna')
    expect(result.source).toBe('llm')
  })

  it('should throw on invalid lieu_fin', () => {
    const raw = {
      action: 'explorer',
      lieu_fin: 'invalid_place',
      cible: null,
      narration: 'Test narration.'
    }

    expect(() => validateActionResponse(raw, lieuxAccessibles, personnagesPresents))
      .toThrow('Invalid lieu_fin')
  })

  it('should nullify invalid cible (soft fail)', () => {
    const raw = {
      action: 'parler',
      lieu_fin: 'heda',
      cible: 'NonExistent',
      narration: 'Test.'
    }

    const result = validateActionResponse(raw, lieuxAccessibles, personnagesPresents)
    expect(result.cible).toBeNull()
  })

  it('should throw on missing required fields', () => {
    const raw = { action: 'test' }

    expect(() => validateActionResponse(raw, lieuxAccessibles, personnagesPresents))
      .toThrow()
  })
})

describe('validateDestinResponse', () => {
  it('should validate a correct destin response', () => {
    const raw = {
      fin_ecrite: 'Luna mourra en paix sous un arbre.',
      paliers: [
        { jour_cible: 25, description: 'Première rencontre', atteint: false },
        { jour_cible: 50, description: 'Grande épreuve', atteint: false }
      ],
      inclination_actuelle: 'Curiosité vers le monde'
    }

    const result = validateDestinResponse(raw)

    expect(result.fin_ecrite).toBe('Luna mourra en paix sous un arbre.')
    expect(result.paliers).toHaveLength(2)
    expect(result.paliers[0].atteint).toBe(false)
    expect(result.derniere_recalcul).toBeNull()
  })

  it('should sort paliers by jour_cible', () => {
    const raw = {
      fin_ecrite: 'Test',
      paliers: [
        { jour_cible: 75, description: 'Third', atteint: false },
        { jour_cible: 25, description: 'First', atteint: false },
        { jour_cible: 50, description: 'Second', atteint: false }
      ],
      inclination_actuelle: 'Test'
    }

    const result = validateDestinResponse(raw)

    expect(result.paliers[0].jour_cible).toBe(25)
    expect(result.paliers[1].jour_cible).toBe(50)
    expect(result.paliers[2].jour_cible).toBe(75)
  })

  it('should throw on empty paliers', () => {
    const raw = {
      fin_ecrite: 'Test',
      paliers: [],
      inclination_actuelle: 'Test'
    }

    expect(() => validateDestinResponse(raw)).toThrow()
  })
})

describe('validateResumeResponse', () => {
  it('should validate a correct resume response', () => {
    const raw = { resume: 'Le jour 5 fut calme à Foresta.' }

    const result = validateResumeResponse(raw)
    expect(result).toBe('Le jour 5 fut calme à Foresta.')
  })

  it('should throw on empty resume', () => {
    const raw = { resume: '' }
    expect(() => validateResumeResponse(raw)).toThrow()
  })
})

describe('safeParseJson', () => {
  it('should parse clean JSON', () => {
    const text = '{"action": "test"}'
    const result = safeParseJson(text)
    expect(result).toEqual({ action: 'test' })
  })

  it('should handle markdown code blocks', () => {
    const text = '```json\n{"action": "test"}\n```'
    const result = safeParseJson(text)
    expect(result).toEqual({ action: 'test' })
  })

  it('should extract JSON from surrounding text', () => {
    const text = 'Here is the response: {"action": "test"} That is all.'
    const result = safeParseJson(text)
    expect(result).toEqual({ action: 'test' })
  })

  it('should throw on invalid JSON', () => {
    const text = 'not json at all'
    expect(() => safeParseJson(text)).toThrow()
  })
})

describe('validateActionWithFallback', () => {
  it('should return fallback on validation failure', () => {
    const raw = { invalid: 'data' }

    const result = validateActionWithFallback(
      raw,
      ['heda'],
      [],
      'TestCharacter',
      'heda'
    )

    expect(result.source).toBe('template')
    expect(result.lieu_fin).toBe('heda')
    expect(result.action).toBe('rester')
  })
})
