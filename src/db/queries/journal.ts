/**
 * Foresta V2 - Journal Queries
 */

import { getSupabase, ForestaError } from '../client.js'
import type { JournalEntry, JournalDetails } from '../../types/entities.js'

export async function getJournalEntry(jour: number): Promise<JournalEntry | null> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('journal')
    .select('*')
    .eq('jour', jour)
    .maybeSingle()

  if (error) throw ForestaError.fromSupabase(error)
  return data as JournalEntry | null
}

export async function getRecentJournal(limit: number = 5): Promise<JournalEntry[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('journal')
    .select('*')
    .order('jour', { ascending: false })
    .limit(limit)

  if (error) throw ForestaError.fromSupabase(error)
  return data as JournalEntry[]
}

export async function createJournalEntry(
  jour: number,
  resume: string,
  details: JournalDetails,
  degraded_day: boolean = false
): Promise<JournalEntry> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('journal')
    .insert({
      jour,
      resume,
      details,
      degraded_day
    })
    .select()
    .single()

  if (error) throw ForestaError.fromSupabase(error)
  return data as JournalEntry
}

export async function journalExists(jour: number): Promise<boolean> {
  const entry = await getJournalEntry(jour)
  return entry !== null
}
