/**
 * Foresta V2 - Orchestrator Pipeline
 * 6-step cycle: COLLECT → ANALYZE → EXECUTE → RESOLVE → NOTIFY → LOG
 */

import type {
  CycleResult,
  CollectOutput,
  AnalyzeOutput,
  ExecuteOutput,
  ResolveOutput,
  NotifyOutput,
  LogOutput,
  PersonnageDecision,
  SkippedPersonnage,
  Tension,
  OutcomeApplique,
  DestinRecalcule,
  RelationUpdate
} from '../types/orchestrator.js'
import type { JournalDetails } from '../types/entities.js'

import { getMonde, incrementJour } from '../db/queries/monde.js'
import { getPersonnagesVivants, cleanupStaleConversations, getPersonnageById } from '../db/queries/personnages.js'
import { getTerritoiresMap } from '../db/queries/territoires.js'
import { getEvenementsActifs } from '../db/queries/evenements.js'
import { createJournalEntry, journalExists } from '../db/queries/journal.js'
import { acquireLock, releaseLock, addProcessedCharacter, isCharacterProcessed } from '../db/queries/cycle-lock.js'

import { generateContext, executeDay, applyOutcome, updateRelationsFromInteraction } from './actions.js'
import { shouldRecalculateDestiny, recalculateDestiny, checkPalierReached, markPalierReached } from './destiny.js'
import { checkLLMHealth, callLLMJson } from '../llm/client.js'
import { buildResumeSystemPrompt, buildResumeUserPrompt, type ResumeDayContext } from '../llm/prompts/resume.js'
import { validateResumeResponse } from './validation.js'

// ============================================
// TELEGRAM NOTIFICATION (placeholder)
// ============================================
let telegramNotifier: ((message: string) => Promise<void>) | null = null

export function setTelegramNotifier(notifier: (message: string) => Promise<void>): void {
  telegramNotifier = notifier
}

async function sendTelegramNotification(message: string): Promise<boolean> {
  if (!telegramNotifier) {
    console.warn('No Telegram notifier configured')
    return false
  }

  try {
    await telegramNotifier(message)
    return true
  } catch (error) {
    console.error('Failed to send Telegram notification:', error)
    return false
  }
}

// ============================================
// MAIN ORCHESTRATOR
// ============================================
export async function runCycle(): Promise<CycleResult> {
  const monde = await getMonde()

  // Check if paused
  if (monde.paused) {
    return {
      success: false,
      jour: monde.jour_actuel,
      state: 'idle',
      degraded: false,
      error: 'World is paused'
    }
  }

  const jour = monde.jour_actuel

  // Try to acquire lock
  const lock = await acquireLock(jour)
  if (!lock) {
    return {
      success: false,
      jour,
      state: 'idle',
      degraded: false,
      error: 'Cycle already in progress or recently completed'
    }
  }

  // Check if journal already exists (idempotency)
  if (await journalExists(jour)) {
    await releaseLock(lock.id, 'complete')
    return {
      success: false,
      jour,
      state: 'complete',
      degraded: false,
      error: 'Day already processed'
    }
  }

  // Check LLM health
  const llmHealthy = await checkLLMHealth()
  const degraded = !llmHealthy

  if (degraded) {
    console.warn(`⚠️ Day ${jour} running in degraded mode (LLM unavailable)`)
  }

  // Cleanup stale conversations
  await cleanupStaleConversations(30)

  try {
    // PHASE 1: COLLECT
    const collect = await phaseCollect(jour)

    // PHASE 2: ANALYZE
    const analyze = await phaseAnalyze(collect)

    // PHASE 3: EXECUTE
    const execute = await phaseExecute(collect, analyze, lock.id, jour, degraded)

    // PHASE 4: RESOLVE
    const resolve = await phaseResolve(execute, jour)

    // PHASE 5: NOTIFY
    const notify = await phaseNotify(execute, collect, jour, degraded)

    // PHASE 6: LOG (use same resume from notify)
    const log = await phaseLog(execute, collect, notify.resume_genere, jour, degraded)

    // Increment day
    await incrementJour()

    // Release lock
    await releaseLock(lock.id, 'complete')

    return {
      success: true,
      jour,
      state: 'complete',
      degraded,
      collect,
      analyze,
      execute,
      resolve,
      notify,
      log
    }
  } catch (error) {
    console.error(`Cycle failed for day ${jour}:`, error)

    await releaseLock(lock.id, 'failed')

    // Send failure notification
    await sendTelegramNotification(`❌ Cycle jour ${jour} échoué: ${(error as Error).message}`)

    return {
      success: false,
      jour,
      state: 'failed',
      degraded,
      error: (error as Error).message
    }
  }
}

// ============================================
// PHASE 1: COLLECT
// ============================================
async function phaseCollect(jour: number): Promise<CollectOutput> {
  const [personnages_vivants, territoiresMap, evenements_actifs] = await Promise.all([
    getPersonnagesVivants(),
    getTerritoiresMap(),
    getEvenementsActifs()
  ])

  return {
    jour,
    personnages_vivants,
    territoires: territoiresMap,
    evenements_actifs
  }
}

// ============================================
// PHASE 2: ANALYZE
// ============================================
async function phaseAnalyze(collect: CollectOutput): Promise<AnalyzeOutput> {
  const { personnages_vivants, evenements_actifs } = collect

  // Find tensions (simplified analysis)
  const tensions: Tension[] = []

  // Territory-based tensions from events
  for (const evt of evenements_actifs) {
    for (const zone of evt.zone_impact) {
      const affected = personnages_vivants.filter(p => p.position === zone)
      if (affected.length > 0) {
        tensions.push({
          type: 'evenement',
          description: `${evt.type} affects ${zone}`,
          personnages_impliques: affected.map(p => p.nom),
          lieu: zone
        })
      }
    }
  }

  // Characters to process (exclude in_conversation)
  const personnages_a_traiter = personnages_vivants
    .filter(p => !p.in_conversation)
    .map(p => p.id)

  return {
    tensions,
    interactions_planifiees: [], // Could be expanded
    personnages_a_traiter
  }
}

// ============================================
// PHASE 3: EXECUTE
// ============================================
async function phaseExecute(
  collect: CollectOutput,
  analyze: AnalyzeOutput,
  lockId: string,
  jour: number,
  degraded: boolean
): Promise<ExecuteOutput> {
  const decisions: PersonnageDecision[] = []
  const skipped: SkippedPersonnage[] = []

  const { personnages_vivants } = collect
  const { personnages_a_traiter } = analyze
  const toProcessSet = new Set(personnages_a_traiter)

  // Process each character - use personnages_a_traiter from analyze phase
  for (const personnage of personnages_vivants) {
    // Check if filtered out by analyze phase (in_conversation)
    if (!toProcessSet.has(personnage.id)) {
      skipped.push({
        personnage_id: personnage.id,
        personnage_nom: personnage.nom,
        raison: 'in_conversation'
      })
      continue
    }

    // Check if already processed (idempotency)
    if (await isCharacterProcessed(lockId, personnage.id)) {
      skipped.push({
        personnage_id: personnage.id,
        personnage_nom: personnage.nom,
        raison: 'already_processed'
      })
      continue
    }

    try {
      // Generate context
      const contexte = await generateContext(personnage, jour)

      // Execute day
      const action = await executeDay(personnage, contexte, jour, degraded)

      decisions.push({
        personnage_id: personnage.id,
        personnage_nom: personnage.nom,
        contexte,
        action
      })

      // Mark as processed
      await addProcessedCharacter(lockId, personnage.id)
    } catch (error) {
      console.error(`Failed to execute for ${personnage.nom}:`, error)
      skipped.push({
        personnage_id: personnage.id,
        personnage_nom: personnage.nom,
        raison: 'error'
      })
    }
  }

  return { decisions, skipped }
}

// ============================================
// PHASE 4: RESOLVE
// ============================================
async function phaseResolve(execute: ExecuteOutput, jour: number): Promise<ResolveOutput> {
  const outcomes_appliques: OutcomeApplique[] = []
  const destins_recalcules: DestinRecalcule[] = []
  const relations_mises_a_jour: RelationUpdate[] = []

  for (const decision of execute.decisions) {
    const { personnage_id, action, contexte } = decision

    // Apply outcome
    const updated = await applyOutcome(contexte.personnage, action, jour)

    outcomes_appliques.push({
      personnage_id,
      nouvelle_position: action.lieu_fin,
      action_resumee: action.action
    })

    // Handle interactions → update relations
    if (action.cible) {
      const target = contexte.personnages_presents.find(p => p.nom === action.cible)
      if (target) {
        await updateRelationsFromInteraction(updated, target)
        relations_mises_a_jour.push({
          personnage_a: updated.nom,
          personnage_b: target.nom,
          type_relation: 'connaissance',
          delta_intensite: 0.1
        })
      }
    }

    // Check destiny
    const personnage = await getPersonnageById(personnage_id)

    // Check if palier reached
    if (checkPalierReached(personnage, jour, action.action, action.lieu_fin)) {
      const palierIndex = personnage.destin?.paliers.findIndex(
        p => !p.atteint &&
          jour >= p.jour_cible - 5 &&
          jour <= p.jour_cible + 5
      )
      if (palierIndex !== undefined && palierIndex >= 0) {
        await markPalierReached(personnage, jour, palierIndex)
      }
    }

    // Check if should recalculate destiny
    const recalculCheck = shouldRecalculateDestiny(personnage, jour)
    if (recalculCheck.shouldRecalcul && recalculCheck.raison) {
      const oldDestin = personnage.destin?.fin_ecrite || 'inconnu'
      const newDestin = await recalculateDestiny(personnage, recalculCheck.raison, jour)

      destins_recalcules.push({
        personnage_id,
        personnage_nom: personnage.nom,
        raison: recalculCheck.raison,
        ancien_destin: oldDestin,
        nouveau_destin: newDestin.fin_ecrite
      })
    }
  }

  return {
    outcomes_appliques,
    destins_recalcules,
    relations_mises_a_jour
  }
}

// ============================================
// PHASE 5: NOTIFY
// ============================================
async function phaseNotify(execute: ExecuteOutput, collect: CollectOutput, jour: number, degraded: boolean): Promise<NotifyOutput> {
  // Build resume context
  const actions = execute.decisions.map(d => ({
    personnage: d.contexte.personnage,
    action: d.action
  }))

  let resume_genere: string

  if (degraded || actions.length === 0) {
    // Fallback resume
    const degradedNote = degraded ? ' (mode dégradé)' : ''
    resume_genere = `Jour ${jour} à Foresta${degradedNote}. ${actions.length} habitants ont vécu leur journée.`
  } else {
    try {
      const ctx: ResumeDayContext = {
        jour,
        actions,
        evenements_actifs: collect.evenements_actifs.length,
        degraded
      }

      const systemPrompt = buildResumeSystemPrompt()
      const userPrompt = buildResumeUserPrompt(ctx)

      const response = await callLLMJson<unknown>(systemPrompt, userPrompt)
      resume_genere = validateResumeResponse(response)
    } catch {
      resume_genere = `Jour ${jour} à Foresta. Les habitants ont vécu leur journée.`
    }
  }

  // Format Telegram message
  const emoji = degraded ? '⚠️' : '☀️'
  const message = `${emoji} **Jour ${jour}**\n\n${resume_genere}`

  const telegram_envoye = await sendTelegramNotification(message)

  return {
    resume_genere,
    telegram_envoye
  }
}

// ============================================
// PHASE 6: LOG
// ============================================
async function phaseLog(execute: ExecuteOutput, collect: CollectOutput, resume: string, jour: number, degraded: boolean): Promise<LogOutput> {
  const details: JournalDetails = {
    personnages_traites: execute.decisions.length,
    evenements_actifs: collect.evenements_actifs.length,
    actions: execute.decisions.map(d => ({
      personnage_nom: d.personnage_nom,
      action: d.action.action,
      lieu: d.action.lieu_fin
    }))
  }

  // Use same resume from notify phase
  const entry = await createJournalEntry(jour, resume, details, degraded)

  return {
    journal_id: entry.id,
    journees_personnages_mises_a_jour: execute.decisions.length
  }
}
