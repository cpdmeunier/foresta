/**
 * Foresta V2 - Bot Setup
 * Telegram bot initialization with Telegraf
 */

import { Telegraf } from 'telegraf'
import { createAuthMiddleware } from './middleware/auth.js'
import { setTelegramNotifier } from '../engine/orchestrator.js'
import { cleanupStaleConversations } from '../db/queries/personnages.js'

// Command imports (to be added)
import { registerLookCommand } from './commands/look.js'
import { registerMondeCommand } from './commands/monde.js'
import { registerDestinsCommand } from './commands/destins.js'
import { registerCreateCommand } from './commands/create.js'
import { registerConseillerCommand } from './commands/conseiller.js'
import { registerKillCommand } from './commands/kill.js'
import { registerEventCommand } from './commands/event.js'
import { registerJourCommand } from './commands/jour.js'
import { registerPauseCommand } from './commands/pause.js'
import { registerPlayCommand } from './commands/play.js'

let bot: Telegraf | null = null

export function createBot(): Telegraf {
  const token = process.env.TELEGRAM_BOT_TOKEN

  if (!token) {
    throw new Error('Missing TELEGRAM_BOT_TOKEN environment variable')
  }

  bot = new Telegraf(token)

  // Apply auth middleware
  bot.use(createAuthMiddleware())

  // Register commands
  registerLookCommand(bot)
  registerMondeCommand(bot)
  registerDestinsCommand(bot)
  registerCreateCommand(bot)
  registerConseillerCommand(bot)
  registerKillCommand(bot)
  registerEventCommand(bot)
  registerJourCommand(bot)
  registerPauseCommand(bot)
  registerPlayCommand(bot)

  // Help command
  bot.help((ctx) => {
    ctx.reply(`🌲 **Foresta V2 - Commandes**

**Observation:**
/look [nom] - Observer un personnage ou le monde
/monde - État global du monde
/destins - Progression des destins

**Action:**
/create - Créer un nouveau personnage
/conseiller [nom] - Parler à un personnage
/kill [nom] - Tuer un personnage
/event [type] - Créer un événement

**Temps:**
/jour - Forcer le passage d'un jour
/pause - Mettre le monde en pause
/play - Reprendre le temps`, { parse_mode: 'Markdown' })
  })

  // Start command
  bot.start((ctx) => {
    ctx.reply(`🌲 Bienvenue dans Foresta V2, Démiurge.

Le monde attend vos ordres. Tapez /help pour voir les commandes disponibles.

Statut: ${process.env.NODE_ENV === 'production' ? '🟢 Production' : '🟡 Développement'}`)
  })

  // Set up notifier for orchestrator
  const chatId = process.env.AUTHORIZED_CHAT_ID
  if (chatId) {
    setTelegramNotifier(async (message: string) => {
      await bot!.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' })
    })
  }

  return bot
}

export function getBot(): Telegraf | null {
  return bot
}

export async function startBot(): Promise<void> {
  if (!bot) {
    bot = createBot()
  }

  console.log('🤖 Starting Foresta V2 bot...')

  // Cleanup stale conversations from previous runs
  try {
    const cleaned = await cleanupStaleConversations(0) // Clear all in_conversation flags
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} stale conversation(s) from previous run`)
    }
  } catch (error) {
    console.warn('Failed to cleanup stale conversations:', error)
  }

  // Launch bot
  await bot.launch()

  console.log('🌲 Foresta V2 bot is running!')
}

export async function stopBot(): Promise<void> {
  if (bot) {
    bot.stop('SIGTERM')
    bot = null
  }
}
