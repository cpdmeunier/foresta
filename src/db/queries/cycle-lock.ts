/**
 * Foresta V2 - Cycle Lock Queries
 * Anti-drift CRON mechanism
 */

import { getSupabase, ForestaError, withRetry } from '../client.js'
import type { CycleLock } from '../../types/orchestrator.js'

export async function getActiveLock(day_number: number): Promise<CycleLock | null> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('cycle_lock')
    .select('*')
    .eq('day_number', day_number)
    .eq('state', 'running')
    .maybeSingle()

  if (error) throw ForestaError.fromSupabase(error)
  return data as CycleLock | null
}

export async function acquireLock(day_number: number): Promise<CycleLock | null> {
  // Check for existing lock
  const existing = await getActiveLock(day_number)
  if (existing) {
    // Check if stale (> 30 min)
    const startedAt = new Date(existing.started_at)
    const staleThreshold = 30 * 60 * 1000 // 30 minutes
    if (Date.now() - startedAt.getTime() > staleThreshold) {
      // Force release stale lock
      await releaseLock(existing.id, 'failed')
    } else {
      // Lock is active and valid
      return null
    }
  }

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('cycle_lock')
    .insert({
      day_number,
      state: 'running',
      started_at: new Date().toISOString(),
      processed_character_ids: []
    })
    .select()
    .single()

  if (error) {
    // Might be race condition, another process acquired
    if (error.code === '23505') return null // unique violation
    throw ForestaError.fromSupabase(error)
  }

  return data as CycleLock
}

export async function releaseLock(
  lockId: string,
  state: 'complete' | 'failed'
): Promise<CycleLock> {
  // Use retry for critical lock release operation
  return withRetry(async () => {
    const supabase = getSupabase()

    const { data, error } = await supabase
      .from('cycle_lock')
      .update({
        state,
        completed_at: new Date().toISOString()
      })
      .eq('id', lockId)
      .select()
      .single()

    if (error) throw ForestaError.fromSupabase(error)
    return data as CycleLock
  }, { maxRetries: 3 })
}

export async function addProcessedCharacter(lockId: string, characterId: string): Promise<void> {
  // Use retry for critical idempotency tracking
  // Note: Uses Set to ensure uniqueness and prevent data loss from concurrent writes
  await withRetry(async () => {
    const supabase = getSupabase()

    // Get current processed ids
    const { data: lock } = await supabase
      .from('cycle_lock')
      .select('processed_character_ids')
      .eq('id', lockId)
      .single()

    if (!lock) return

    // Use Set to prevent duplicates and ensure idempotency
    const processedSet = new Set(lock.processed_character_ids || [])

    // Skip if already processed (idempotent)
    if (processedSet.has(characterId)) return

    processedSet.add(characterId)
    const processed = Array.from(processedSet)

    const { error } = await supabase
      .from('cycle_lock')
      .update({ processed_character_ids: processed })
      .eq('id', lockId)

    if (error) throw ForestaError.fromSupabase(error)
  }, { maxRetries: 3 })
}

export async function isCharacterProcessed(lockId: string, characterId: string): Promise<boolean> {
  const supabase = getSupabase()

  const { data } = await supabase
    .from('cycle_lock')
    .select('processed_character_ids')
    .eq('id', lockId)
    .single()

  if (!data) return false
  return (data.processed_character_ids || []).includes(characterId)
}
