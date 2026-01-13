/**
 * Foresta V2 - /pause Command
 * Mettre le monde en pause
 */

import type { Telegraf } from 'telegraf'
import { setPaused, getMonde } from '../../db/queries/monde.js'
import { TELEGRAM_FORMAT } from '../../types/commands.js'

export function registerPauseCommand(bot: Telegraf): void {
  bot.command('pause', async (ctx) => {
    try {
      const monde = await getMonde()

      if (monde.paused) {
        await ctx.reply(`${TELEGRAM_FORMAT.paused} Le monde est déjà en pause.`)
        return
      }

      await setPaused(true)

      await ctx.reply(`${TELEGRAM_FORMAT.paused} **Monde en pause.**

Jour actuel: ${monde.jour_actuel}

Utilisez /play pour reprendre.`, { parse_mode: 'Markdown' })

    } catch (error) {
      await ctx.reply(`${TELEGRAM_FORMAT.error} Erreur: ${(error as Error).message}`)
    }
  })
}
