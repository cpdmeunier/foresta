/**
 * Foresta V2 - /conseiller Command
 * Conversation avec un personnage
 */

import type { Telegraf } from 'telegraf'
import { getPersonnageByNom, getPersonnageById, setInConversation, getPersonnagesAtPosition } from '../../db/queries/personnages.js'
import { callLLM } from '../../llm/client.js'
import { TELEGRAM_FORMAT } from '../../types/commands.js'
import type { ConseillerSession } from '../../types/commands.js'
import type { Personnage } from '../../types/entities.js'

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
  const { personnage_id, personnage_nom, messages } = session

  // Fetch current personnage data for context
  let personnage: Personnage
  let otherPresents: Personnage[] = []
  try {
    personnage = await getPersonnageById(personnage_id)
    const allPresents = await getPersonnagesAtPosition(personnage.position)
    otherPresents = allPresents.filter(p => p.id !== personnage_id && p.vivant)
  } catch {
    // Fallback if fetch fails
    return `*regarde silencieusement*`
  }

  // Build conversation history (limited, simple format)
  const history = messages
    .slice(-4)
    .map(m => m.role === 'user' ? `[Conseiller dit: "${m.content}"]` : `[Tu as répondu: "${m.content}"]`)
    .join('\n')

  // Build context about what the character actually knows
  const traits = personnage.traits.join(', ')
  const age = personnage.age
  const position = personnage.position

  const relationsInfo = personnage.relations.length > 0
    ? `Tu connais: ${personnage.relations.map(r => r.personnage_nom).join(', ')}`
    : `Tu n'as rencontré personne pour l'instant`

  const presentsInfo = otherPresents.length > 0
    ? `Avec toi: ${otherPresents.map(p => p.nom).join(', ')}`
    : `Tu es seul(e)`

  const recentDays = personnage.journees_recentes.length > 0
    ? personnage.journees_recentes.slice(-3).map(j => j.action).join('. ')
    : `Tu viens d'arriver dans ce monde`

  const systemPrompt = `Tu incarnes ${personnage_nom}. Une voix mystérieuse te parle dans tes rêves.

QUI TU ES:
- Traits: ${traits}
- Âge: ${age} jours
- Lieu: ${position}
- ${relationsInfo}
- ${presentsInfo}
- ${recentDays}

FORMAT DE RÉPONSE:
- Écris SEULEMENT ce que ${personnage_nom} dit (1-2 phrases max)
- PAS de préfixe "Nom:" - juste le texte de ta réponse
- PAS de dialogue fictif - une seule réplique
- Direct, pas de poésie
- Tu ne connais QUE ce qui est listé ci-dessus`

  const userPrompt = `${history ? `Contexte:\n${history}\n\n` : ''}Le conseiller te dit: "${userMessage}"

Ta réponse (juste le texte, sans préfixe):`

  try {
    let response = await callLLM(systemPrompt, userPrompt, {
      maxTokens: 100,
      temperature: 0.7
    })

    // Aggressive cleanup
    response = cleanupResponse(response, personnage_nom)

    return response || '*te regarde en silence*'
  } catch {
    return `*regarde silencieusement*`
  }
}

function cleanupResponse(response: string, personnage_nom: string): string {
  let text = response.trim()

  // Cut at any sign of the advisor speaking
  const cutPatterns = [
    /\n\s*Conseiller\s*:/i,
    /\n\s*\[Conseiller/i,
    /\n\s*Le conseiller/i,
    new RegExp(`\\n\\s*${personnage_nom}\\s*:`, 'i'), // Character speaking again = dialogue
  ]

  for (const pattern of cutPatterns) {
    const match = text.match(pattern)
    if (match && match.index !== undefined) {
      text = text.substring(0, match.index)
    }
  }

  // Remove character name prefix
  const prefixPattern = new RegExp(`^${personnage_nom}\\s*:\\s*`, 'i')
  text = text.replace(prefixPattern, '')

  // Remove quotes if wrapped
  if (text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1)
  }

  // Take only first 2 sentences max
  const sentences = text.split(/(?<=[.!?])\s+/)
  if (sentences.length > 2) {
    text = sentences.slice(0, 2).join(' ')
  }

  return text.trim()
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
