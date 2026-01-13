/**
 * Foresta V2 - Personnages Queries
 */

import { getSupabase, ForestaError } from '../client.js'
import type {
  Personnage,
  CreatePersonnage,
  Destin,
  JourneeResume,
  Relation,
  ActionResult
} from '../../types/entities.js'

// ============================================
// READ
// ============================================
export async function getAllPersonnages(): Promise<Personnage[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('personnages')
    .select('*')
    .order('created_at')

  if (error) throw ForestaError.fromSupabase(error)
  // Type cast assumes DB schema matches TypeScript types
  // In production, consider runtime validation with Zod
  return data as Personnage[]
}

export async function getPersonnagesVivants(): Promise<Personnage[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('personnages')
    .select('*')
    .eq('vivant', true)
    .order('nom')

  if (error) throw ForestaError.fromSupabase(error)
  return data as Personnage[]
}

export async function getPersonnageByNom(nom: string): Promise<Personnage> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('personnages')
    .select('*')
    .ilike('nom', nom)
    .single()

  if (error) throw ForestaError.fromSupabase(error)
  if (!data) throw ForestaError.notFound('Personnage', nom)

  return data as Personnage
}

export async function getPersonnageById(id: string): Promise<Personnage> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('personnages')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw ForestaError.fromSupabase(error)
  if (!data) throw ForestaError.notFound('Personnage', id)

  return data as Personnage
}

export async function getPersonnagesAtPosition(position: string): Promise<Personnage[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('personnages')
    .select('*')
    .eq('position', position)
    .eq('vivant', true)

  if (error) throw ForestaError.fromSupabase(error)
  return data as Personnage[]
}

// ============================================
// CREATE
// ============================================
export async function createPersonnage(input: CreatePersonnage): Promise<Personnage> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('personnages')
    .insert({
      nom: input.nom,
      traits: input.traits,
      position: input.position || 'heda',
      age: 0,
      vivant: true,
      destin: null,
      journees_recentes: [],
      relations: [],
      in_conversation: false,
      in_conversation_since: null,
      derniere_action: null,
      jour_derniere_action: null
    })
    .select()
    .single()

  if (error) throw ForestaError.fromSupabase(error)
  return data as Personnage
}

// ============================================
// UPDATE
// ============================================
export async function updatePersonnageDestin(id: string, destin: Destin): Promise<Personnage> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('personnages')
    .update({ destin })
    .eq('id', id)
    .select()
    .single()

  if (error) throw ForestaError.fromSupabase(error)
  return data as Personnage
}

export async function updatePersonnagePosition(id: string, position: string): Promise<Personnage> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('personnages')
    .update({ position })
    .eq('id', id)
    .select()
    .single()

  if (error) throw ForestaError.fromSupabase(error)
  return data as Personnage
}

export async function updatePersonnageAction(
  id: string,
  action: ActionResult,
  jour: number
): Promise<Personnage> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('personnages')
    .update({
      derniere_action: action,
      jour_derniere_action: jour,
      position: action.lieu_fin
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw ForestaError.fromSupabase(error)
  return data as Personnage
}

const MAX_AGE = 100 // Natural death at 100 days

export async function addJourneeRecente(id: string, journee: JourneeResume): Promise<Personnage> {
  const personnage = await getPersonnageById(id)

  // Keep only last 5 days
  const journees = [...personnage.journees_recentes, journee].slice(-5)
  const newAge = personnage.age + 1

  // Check for natural death at 100 days
  const shouldDie = newAge >= MAX_AGE

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('personnages')
    .update({
      journees_recentes: journees,
      age: newAge,
      vivant: shouldDie ? false : personnage.vivant
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw ForestaError.fromSupabase(error)

  if (shouldDie) {
    console.log(`💀 ${personnage.nom} est mort de vieillesse à ${newAge} jours.`)
  }

  return data as Personnage
}

export async function updateRelations(id: string, relations: Relation[]): Promise<Personnage> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('personnages')
    .update({ relations })
    .eq('id', id)
    .select()
    .single()

  if (error) throw ForestaError.fromSupabase(error)
  return data as Personnage
}

// ============================================
// CONVERSATION
// ============================================
export async function setInConversation(id: string, inConversation: boolean): Promise<Personnage> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('personnages')
    .update({
      in_conversation: inConversation,
      in_conversation_since: inConversation ? new Date().toISOString() : null
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw ForestaError.fromSupabase(error)
  return data as Personnage
}

/**
 * Cleanup stale conversations.
 * @param maxMinutes - Max age in minutes. Use 0 to clear ALL in_conversation flags (useful at startup).
 */
export async function cleanupStaleConversations(maxMinutes: number = 30): Promise<number> {
  const supabase = getSupabase()
  // When maxMinutes=0, cutoff is now, so all conversations are considered stale
  const cutoff = new Date(Date.now() - maxMinutes * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('personnages')
    .update({
      in_conversation: false,
      in_conversation_since: null
    })
    .eq('in_conversation', true)
    .lt('in_conversation_since', cutoff)
    .select()

  if (error) throw ForestaError.fromSupabase(error)
  return data?.length || 0
}

// ============================================
// KILL
// ============================================
export async function killPersonnage(id: string): Promise<Personnage> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('personnages')
    .update({ vivant: false })
    .eq('id', id)
    .select()
    .single()

  if (error) throw ForestaError.fromSupabase(error)
  return data as Personnage
}
