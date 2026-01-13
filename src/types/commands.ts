/**
 * Foresta V2 - Command Types
 * Telegram bot command interfaces
 */

import type { Context } from 'telegraf'
import type { Personnage, Territoire, Evenement, Destin } from './entities.js'

// ============================================
// COMMAND CONTEXT
// ============================================
export interface ForestaContext extends Context {
  // Extended context if needed
}

// ============================================
// COMMAND RESPONSES
// ============================================

// /look response
export interface LookResponse {
  personnage: Personnage
  territoire: Territoire
  personnages_presents: Personnage[]
  evenements_locaux: Evenement[]
}

// /monde response
export interface MondeResponse {
  jour: number
  paused: boolean
  personnages_vivants: number
  personnages_morts: number
  evenements_actifs: number
  territoires: TerritoireStatus[]
}

export interface TerritoireStatus {
  nom: string
  personnages_count: number
  evenements_count: number
  etat: string
}

// /destins response
export interface DestinsResponse {
  personnages: DestinPersonnage[]
}

export interface DestinPersonnage {
  nom: string
  age: number
  destin: Destin | null
  prochain_palier: PalierInfo | null
}

export interface PalierInfo {
  jour_cible: number
  description: string
  jours_restants: number
}

// /create wizard
export interface CreateWizardState {
  step: 'nom' | 'traits' | 'position' | 'confirm'
  nom?: string
  traits?: string[]
  position?: string
}

// /conseiller session
export interface ConseillerSession {
  personnage_id: string
  personnage_nom: string
  started_at: Date
  messages: ConseillerMessage[]
}

export interface ConseillerMessage {
  role: 'user' | 'conseiller'
  content: string
  timestamp: Date
}

// /event types
export type EventType =
  | 'catastrophe'
  | 'benediction'
  | 'migration'
  | 'maladie'
  | 'abondance'

export interface CreateEventParams {
  type: EventType
  description: string
  zones: string[]
  duree?: number
}

// ============================================
// FORMATTING
// ============================================
export interface TelegramFormat {
  // Emojis for states
  vivant: string
  mort: string
  paused: string
  running: string
  warning: string
  success: string
  error: string

  // Domain emojis
  personnage: string
  territoire: string
  evenement: string
  destin: string
  jour: string
}

export const TELEGRAM_FORMAT: TelegramFormat = {
  vivant: '🌿',
  mort: '💀',
  paused: '⏸️',
  running: '▶️',
  warning: '⚠️',
  success: '✅',
  error: '❌',
  personnage: '🦊',
  territoire: '🏕️',
  evenement: '⚡',
  destin: '🔮',
  jour: '☀️'
}
