/**
 * Foresta V2 - /conseiller Command
 * Conversation avec un personnage
 */

import type { Telegraf } from 'telegraf'
import { getPersonnageByNom, setInConversation } from '../../db/queries/personnages.js'
import { callLLM } from '../../llm/client.js'
import { TELEGRAM_FORMAT } from '../../types/commands.js'
import type { ConseillerSession } from '../../types/commands.js'

// Active sessions with timeout
const SESSION_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes
const conseillerSessions = new Map<number, ConseillerSession>()

// Cleanup expired sessions
function cleanupExpiredSessions(): void {
  const now = Date.now()
  for (const [chatId, session] of conseillerSessions.entries()) {
    if (now - session.started_at.getTime() > SESSION_TIMEOUT_MS) {
      endConversation(chatId).catch(console.error)
    }
  }
}

export function registerConseillerCommand(bot: Telegraf): void {
  // Start conversation
  bot.command('conseiller', async (ctx) => {
    const chatId = ctx.chat?.id
    if (!chatId) return

    // Cleanup expired sessions first
    cleanupExpiredSessions()

    const args = ctx.message.text.split(' ').slice(1)
    const nom = args.join(' ').trim()

    if (!nom) {
      await ctx.reply(`Usage: /conseiller [nom du personnage]`)
      return
    }

    try {
      const personnage = await getPersonnageByNom(nom)

      if (!personnage.vivant) {
        await ctx.reply(`${TELEGRAM_FORMAT.mort} ${personnage.nom} n'est plus de ce monde.`)
        return
      }

      if (personnage.in_conversation) {
        await ctx.reply(`${TELEGRAM_FORMAT.warning} ${personnage.nom} est déjà en conversation.`)
        return
      }

      // Set in_conversation flag
      await setInConversation(personnage.id, true)

      // Create session
      const session: ConseillerSession = {
        personnage_id: personnage.id,
        personnage_nom: personnage.nom,
        started_at: new Date(),
        messages: []
      }
      conseillerSessions.set(chatId, session)

      const traits = personnage.traits.join(', ')
      await ctx.reply(`${TELEGRAM_FORMAT.personnage} **Conversation avec ${personnage.nom}**

_Traits: ${traits}_
_Position: ${personnage.position}_

Vous pouvez maintenant parler à ${personnage.nom}.
Tapez /fin pour terminer la conversation.`, { parse_mode: 'Markdown' })

    } catch (error) {
      await ctx.reply(`${TELEGRAM_FORMAT.error} Personnage "${nom}" non trouvé.`)
    }
  })

  // End conversation
  bot.command('fin', async (ctx) => {
    const chatId = ctx.chat?.id
    if (!chatId) return

    const session = conseillerSessions.get(chatId)
    if (!session) {
      await ctx.reply(`Aucune conversation en cours.`)
      return
    }

    await endConversation(chatId)
    await ctx.reply(`${TELEGRAM_FORMAT.success} Conversation avec ${session.personnage_nom} terminée.`)
  })

  // Handle conversation messages
  bot.on('text', async (ctx, next) => {
    const chatId = ctx.chat?.id
    if (!chatId) return next()

    const session = conseillerSessions.get(chatId)
    if (!session) return next()

    // Check session timeout
    if (Date.now() - session.started_at.getTime() > SESSION_TIMEOUT_MS) {
      await endConversation(chatId)
      await ctx.reply(`${TELEGRAM_FORMAT.warning} Session expirée. Relance /conseiller pour recommencer.`)
      return
    }

    const text = ctx.message.text.trim()

    // Skip commands
    if (text.startsWith('/')) return next()

    try {
      const response = await generateResponse(session, text)

      // Store messages
      session.messages.push({ role: 'user', content: text, timestamp: new Date() })
      session.messages.push({ role: 'conseiller', content: response, timestamp: new Date() })
      conseillerSessions.set(chatId, session)

      await ctx.reply(`**${session.personnage_nom}:** ${response}`, { parse_mode: 'Markdown' })
    } catch (error) {
      await ctx.reply(`${TELEGRAM_FORMAT.error} Erreur: ${(error as Error).message}`)
    }
  })
}

async function generateResponse(session: ConseillerSession, userMessage: string): Promise<string> {
  const { personnage_nom, messages } = session

  // Build conversation history
  const history = messages
    .slice(-6) // Last 6 messages for context
    .map(m => `${m.role === 'user' ? 'Conseiller' : personnage_nom}: ${m.content}`)
    .join('\n')

  const systemPrompt = `Tu es ${personnage_nom}. Tu parles à ton conseiller (une voix dans tes rêves).
Tu ne sais pas grand-chose du monde - juste ce que tu as vécu.
Réponds naturellement, 1-3 phrases. Direct, pas de poésie.
Tu peux avoir des doutes, des questions, des émotions.`

  const userPrompt = `${history ? `Historique:\n${history}\n\n` : ''}Conseiller: ${userMessage}

${personnage_nom}:`

  try {
    const response = await callLLM(systemPrompt, userPrompt, {
      maxTokens: 300,
      temperature: 0.8
    })
    return response.trim()
  } catch {
    return `*regarde silencieusement*`
  }
}

async function endConversation(chatId: number): Promise<void> {
  const session = conseillerSessions.get(chatId)
  if (!session) return

  try {
    await setInConversation(session.personnage_id, false)
  } catch (error) {
    console.error('Failed to reset conversation flag:', error)
  }

  conseillerSessions.delete(chatId)
}
