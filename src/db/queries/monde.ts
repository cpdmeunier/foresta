/**
 * Foresta V2 - Monde Queries
 * Singleton world state operations
 */

import { getSupabase, ForestaError } from '../client.js'
import type { Monde } from '../../types/entities.js'

export async function getMonde(): Promise<Monde> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('monde')
    .select('*')
    .limit(1)
    .single()

  if (error) throw ForestaError.fromSupabase(error)
  if (!data) throw ForestaError.notFound('Monde', 'singleton')

  return data as Monde
}

export async function updateMonde(updates: Partial<Pick<Monde, 'jour_actuel' | 'paused' | 'last_cycle_at'>>): Promise<Monde> {
  const supabase = getSupabase()

  // Get current monde id first
  const monde = await getMonde()

  const { data, error } = await supabase
    .from('monde')
    .update(updates)
    .eq('id', monde.id)
    .select()
    .single()

  if (error) throw ForestaError.fromSupabase(error)
  return data as Monde
}

export async function incrementJour(): Promise<Monde> {
  const monde = await getMonde()
  return updateMonde({
    jour_actuel: monde.jour_actuel + 1,
    last_cycle_at: new Date().toISOString()
  })
}

export async function setPaused(paused: boolean): Promise<Monde> {
  return updateMonde({ paused })
}
