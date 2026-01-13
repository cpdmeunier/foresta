/**
 * Foresta V2 - Orchestrator Types
 * Pipeline states, cycle management
 */

import type { Personnage, Territoire, Evenement, ActionResult } from './entities.js'

// ============================================
// PIPELINE STATES
// ============================================
export type PipelineState =
  | 'idle'
  | 'collecting'
  | 'analyzed'
  | 'executed'
  | 'resolved'
  | 'notified'
  | 'complete'
  | 'failed'

export interface CycleLock {
  id: string
  day_number: number
  state: 'running' | 'complete' | 'failed'
  started_at: string
  completed_at: string | null
  processed_character_ids: string[]
}

// ============================================
// CYCLE CONTEXT
// ============================================
export interface CycleContext {
  jour: number
  monde_paused: boolean
  personnages: Personnage[]
  territoires: Territoire[]
  evenements_actifs: Evenement[]
  degraded_mode: boolean
}

// ============================================
// PHASE OUTPUTS
// ============================================

// COLLECT phase output
export interface CollectOutput {
  jour: number
  personnages_vivants: Personnage[]
  territoires: Map<string, Territoire>
  evenements_actifs: Evenement[]
}

// ANALYZE phase output
export interface AnalyzeOutput {
  tensions: Tension[]
  interactions_planifiees: InteractionPlan[]
  personnages_a_traiter: string[]
}

export interface Tension {
  type: 'relation' | 'territoire' | 'evenement'
  description: string
  personnages_impliques: string[]
  lieu: string
}

export interface InteractionPlan {
  personnage_a: string
  personnage_b: string
  lieu: string
  probabilite: number
}

// EXECUTE phase output
export interface ExecuteOutput {
  decisions: PersonnageDecision[]
  skipped: SkippedPersonnage[]
}

export interface PersonnageDecision {
  personnage_id: string
  personnage_nom: string
  contexte: ContextePersonnage
  action: ActionResult
}

export interface SkippedPersonnage {
  personnage_id: string
  personnage_nom: string
  raison: 'in_conversation' | 'already_processed' | 'error'
}

export interface ContextePersonnage {
  personnage: Personnage
  lieu: Territoire
  personnages_presents: Personnage[]
  lieux_accessibles: string[]
  evenements_locaux: Evenement[]
}

// RESOLVE phase output
export interface ResolveOutput {
  outcomes_appliques: OutcomeApplique[]
  destins_recalcules: DestinRecalcule[]
  relations_mises_a_jour: RelationUpdate[]
}

export interface OutcomeApplique {
  personnage_id: string
  nouvelle_position: string
  action_resumee: string
}

export interface DestinRecalcule {
  personnage_id: string
  personnage_nom: string
  raison: 'palier_manque' | 'deviation_seuil'
  ancien_destin: string
  nouveau_destin: string
}

export interface RelationUpdate {
  personnage_a: string
  personnage_b: string
  type_relation: 'connaissance' | 'ami' | 'rival'
  delta_intensite: number
}

// NOTIFY phase output
export interface NotifyOutput {
  resume_genere: string
  telegram_envoye: boolean
}

// LOG phase output
export interface LogOutput {
  journal_id: string
  journees_personnages_mises_a_jour: number
}

// ============================================
// CYCLE RESULT
// ============================================
export interface CycleResult {
  success: boolean
  jour: number
  state: PipelineState
  degraded: boolean
  error?: string
  collect?: CollectOutput
  analyze?: AnalyzeOutput
  execute?: ExecuteOutput
  resolve?: ResolveOutput
  notify?: NotifyOutput
  log?: LogOutput
}
