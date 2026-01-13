/**
 * Foresta V2 - Entity Types
 * Aligned with Supabase schema
 */

// ============================================
// MONDE
// ============================================
export interface Monde {
  id: string
  jour_actuel: number
  paused: boolean
  last_cycle_at: string | null
  created_at: string
  updated_at: string
}

// ============================================
// TERRITOIRE
// ============================================
export interface Territoire {
  id: string
  nom: string
  description: string | null
  connexions: string[]
  etat: string
  effets_actifs: EffetActif[]
  created_at: string
  updated_at: string
}

export interface EffetActif {
  type: string
  description: string
  intensite: number
  jour_debut: number
  jour_fin?: number
}

// ============================================
// PERSONNAGE
// ============================================
export interface Personnage {
  id: string
  nom: string
  traits: string[]
  position: string
  age: number
  vivant: boolean
  destin: Destin | null
  journees_recentes: JourneeResume[]
  relations: Relation[]
  in_conversation: boolean
  in_conversation_since: string | null
  derniere_action: ActionResult | null
  jour_derniere_action: number | null
  created_at: string
  updated_at: string
}

export interface Destin {
  fin_ecrite: string
  inclination_actuelle: string
  paliers: Palier[]
  derniere_recalcul: number | null
}

export interface Palier {
  jour_cible: number
  description: string
  atteint: boolean
}

export interface JourneeResume {
  jour: number
  action: string
  lieu: string
  interactions: string[]
}

export interface Relation {
  personnage_id: string
  personnage_nom: string
  type: 'connaissance' | 'ami' | 'rival'
  intensite: number
}

export interface ActionResult {
  action: string
  lieu_fin: string
  cible: string | null
  narration: string
  source: 'llm' | 'template'
}

// ============================================
// ÉVÉNEMENT
// ============================================
export interface Evenement {
  id: string
  type: string
  description: string
  zone_impact: string[]
  progression: number
  jour_debut: number
  jour_resolution: number | null
  actif: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ============================================
// JOURNAL
// ============================================
export interface JournalEntry {
  id: string
  jour: number
  resume: string
  degraded_day: boolean
  details: JournalDetails
  created_at: string
}

export interface JournalDetails {
  personnages_traites: number
  evenements_actifs: number
  actions: ActionSummary[]
}

export interface ActionSummary {
  personnage_nom: string
  action: string
  lieu: string
}

// ============================================
// CRÉATION HELPERS
// ============================================
export interface CreatePersonnage {
  nom: string
  traits: string[]
  position?: string
}

export interface CreateEvenement {
  type: string
  description: string
  zone_impact: string[]
  jour_debut: number
  jour_resolution?: number
}
