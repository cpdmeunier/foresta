/**
 * Foresta V2 - Evenements Queries
 */

import { getSupabase, ForestaError } from '../client.js'
import type { Evenement, CreateEvenement } from '../../types/entities.js'

export async function getEvenementsActifs(): Promise<Evenement[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('evenements')
    .select('*')
    .eq('actif', true)
    .order('jour_debut')

  if (error) throw ForestaError.fromSupabase(error)
  return data as Evenement[]
}

export async function getEvenementById(id: string): Promise<Evenement> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('evenements')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw ForestaError.fromSupabase(error)
  if (!data) throw ForestaError.notFound('Evenement', id)

  return data as Evenement
}

export async function getEvenementsAtZone(zone: string): Promise<Evenement[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('evenements')
    .select('*')
    .eq('actif', true)
    .contains('zone_impact', [zone])

  if (error) throw ForestaError.fromSupabase(error)
  return data as Evenement[]
}

export async function createEvenement(input: CreateEvenement): Promise<Evenement> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('evenements')
    .insert({
      type: input.type,
      description: input.description,
      zone_impact: input.zone_impact,
      jour_debut: input.jour_debut,
      jour_resolution: input.jour_resolution || null,
      progression: 0,
      actif: true,
      metadata: {}
    })
    .select()
    .single()

  if (error) throw ForestaError.fromSupabase(error)
  return data as Evenement
}

export async function updateEvenementProgression(id: string, progression: number): Promise<Evenement> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('evenements')
    .update({ progression })
    .eq('id', id)
    .select()
    .single()

  if (error) throw ForestaError.fromSupabase(error)
  return data as Evenement
}

export async function resolveEvenement(id: string, jour_resolution: number): Promise<Evenement> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('evenements')
    .update({
      actif: false,
      jour_resolution
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw ForestaError.fromSupabase(error)
  return data as Evenement
}
