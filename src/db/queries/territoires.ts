/**
 * Foresta V2 - Territoires Queries
 */

import { getSupabase, ForestaError } from '../client.js'
import type { Territoire, EffetActif } from '../../types/entities.js'

export async function getAllTerritoires(): Promise<Territoire[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('territoires')
    .select('*')
    .order('nom')

  if (error) throw ForestaError.fromSupabase(error)
  return data as Territoire[]
}

export async function getTerritoireByNom(nom: string): Promise<Territoire> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('territoires')
    .select('*')
    .eq('nom', nom)
    .single()

  if (error) throw ForestaError.fromSupabase(error)
  if (!data) throw ForestaError.notFound('Territoire', nom)

  return data as Territoire
}

export async function getTerritoiresMap(): Promise<Map<string, Territoire>> {
  const territoires = await getAllTerritoires()
  return new Map(territoires.map(t => [t.nom, t]))
}

export async function updateTerritoireEtat(nom: string, etat: string): Promise<Territoire> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('territoires')
    .update({ etat })
    .eq('nom', nom)
    .select()
    .single()

  if (error) throw ForestaError.fromSupabase(error)
  return data as Territoire
}

export async function addEffetActif(nom: string, effet: EffetActif): Promise<Territoire> {
  const territoire = await getTerritoireByNom(nom)
  const effets = [...territoire.effets_actifs, effet]

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('territoires')
    .update({ effets_actifs: effets })
    .eq('nom', nom)
    .select()
    .single()

  if (error) throw ForestaError.fromSupabase(error)
  return data as Territoire
}

export async function getLieuxAccessibles(position: string): Promise<string[]> {
  const territoire = await getTerritoireByNom(position)
  return [position, ...territoire.connexions]
}
