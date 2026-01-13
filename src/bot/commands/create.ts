/**
 * Foresta V2 - /create Command
 * Wizard pour créer un nouveau personnage
 */

import type { Telegraf, Context } from 'telegraf'
import { createPersonnage, getPersonnageByNom } from '../../db/queries/personnages.js'
import { getAllTerritoires } from '../../db/queries/territoires.js'
import { createDestiny } from '../../engine/destiny.js'
import { TELEGRAM_FORMAT } from '../../types/commands.js'

// Session state for wizard with timeout
const SESSION_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const wizardSessions = new Map<number, WizardState>()

interface WizardState {
  step: 'nom' | 'traits' | 'position' | 'confirm'
  nom?: string
  traits?: string[]
  position?: string
  createdAt: number
}

// Cleanup expired sessions
function cleanupExpiredSessions(): void {
  const now = Date.now()
  for (const [chatId, session] of wizardSessions.entries()) {
    if (now - session.createdAt > SESSION_TIMEOUT_MS) {
      wizardSessions.delete(chatId)
    }
  }
}

export function registerCreateCommand(bot: Telegraf): void {
  // Start wizard
  bot.command('create', async (ctx) => {
    const chatId = ctx.chat?.id
    if (!chatId) return

    // Cleanup expired sessions first
    cleanupExpiredSessions()

    // Initialize wizard with timestamp
    wizardSessions.set(chatId, { step: 'nom', createdAt: Date.now() })

    await ctx.reply(`${TELEGRAM_FORMAT.personnage} **Création d'un personnage**

Quel sera son nom?`, { parse_mode: 'Markdown' })
  })

  // Handle wizard responses
  bot.on('text', async (ctx, next) => {
    const chatId = ctx.chat?.id
    if (!chatId) return next()

    const session = wizardSessions.get(chatId)
    if (!session) return next()

    // Check session timeout
    if (Date.now() - session.createdAt > SESSION_TIMEOUT_MS) {
      wizardSessions.delete(chatId)
      await ctx.reply(`${TELEGRAM_FORMAT.warning} Session expirée. Relance /create pour recommencer.`)
      return
    }

    const text = ctx.message.text.trim()

    // Check for cancel
    if (text.toLowerCase() === 'annuler' || text.toLowerCase() === 'cancel') {
      wizardSessions.delete(chatId)
      await ctx.reply(`${TELEGRAM_FORMAT.warning} Création annulée.`)
      return
    }

    try {
      await handleWizardStep(ctx, session, text)
    } catch (error) {
      wizardSessions.delete(chatId)
      await ctx.reply(`${TELEGRAM_FORMAT.error} Erreur: ${(error as Error).message}`)
    }
  })
}

async function handleWizardStep(ctx: Context, session: WizardState, input: string): Promise<void> {
  const chatId = ctx.chat!.id

  switch (session.step) {
    case 'nom':
      if (input.length < 2 || input.length > 20) {
        await ctx.reply('Le nom doit faire entre 2 et 20 caractères.')
        return
      }
      // Check name uniqueness
      try {
        await getPersonnageByNom(input)
        // If we get here, the name exists
        await ctx.reply(`${TELEGRAM_FORMAT.warning} Ce nom existe déjà. Choisis un autre nom.`)
        return
      } catch {
        // Name doesn't exist, we can proceed
      }
      session.nom = input
      session.step = 'traits'
      await ctx.reply(`Parfait, ${session.nom}!

Quels sont ses traits? (3 traits séparés par des virgules)
Ex: curieux, prudent, sociable`)
      break

    case 'traits':
      const traits = input.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0)
      if (traits.length < 1 || traits.length > 5) {
        await ctx.reply('Donne entre 1 et 5 traits, séparés par des virgules.')
        return
      }
      session.traits = traits
      session.step = 'position'

      const territoires = await getAllTerritoires()
      const lieux = territoires.map(t => `• ${t.nom} - ${t.description}`).join('\n')

      await ctx.reply(`Traits: ${traits.join(', ')}

Où naît ${session.nom}?

${lieux}

Réponds avec le nom du territoire:`)
      break

    case 'position':
      const territoiresList = await getAllTerritoires()
      const validPosition = territoiresList.find(t =>
        t.nom.toLowerCase() === input.toLowerCase()
      )

      if (!validPosition) {
        await ctx.reply(`Territoire inconnu. Choisis parmi: ${territoiresList.map(t => t.nom).join(', ')}`)
        return
      }

      session.position = validPosition.nom
      session.step = 'confirm'

      await ctx.reply(`**Confirmation:**

Nom: ${session.nom}
Traits: ${session.traits!.join(', ')}
Lieu de naissance: ${session.position}

Confirmer? (oui/non)`, { parse_mode: 'Markdown' })
      break

    case 'confirm':
      if (input.toLowerCase() === 'oui' || input.toLowerCase() === 'yes' || input.toLowerCase() === 'o') {
        // Create personnage
        const personnage = await createPersonnage({
          nom: session.nom!,
          traits: session.traits!,
          position: session.position
        })

        // Create destiny
        const destin = await createDestiny(personnage)

        wizardSessions.delete(chatId)

        await ctx.reply(`${TELEGRAM_FORMAT.success} **${personnage.nom}** est né à ${personnage.position}!

${TELEGRAM_FORMAT.destin} Son destin: _"${destin.fin_ecrite}"_

Premier palier: Jour ${destin.paliers[0]?.jour_cible || '?'}`, { parse_mode: 'Markdown' })
      } else {
        wizardSessions.delete(chatId)
        await ctx.reply(`${TELEGRAM_FORMAT.warning} Création annulée.`)
      }
      // Session ended, don't re-set
      return
  }

  // Only re-set session if wizard continues
  wizardSessions.set(chatId, session)
}
