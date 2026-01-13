/**
 * Foresta V2 - /play Command
 * Reprendre le temps
 */

import type { Telegraf } from 'telegraf'
import { setPaused, getMonde } from '../../db/queries/monde.js'
import { TELEGRAM_FORMAT } from '../../types/commands.js'

export function registerPlayCommand(bot: Telegraf): void {
  bot.command('play', async (ctx) => {
    try {
      const monde = await getMonde()

      if (!monde.paused) {
        await ctx.reply(`${TELEGRAM_FORMAT.running} Le monde tourne déjà.`)
        return
      }

      await setPaused(false)

      await ctx.reply(`${TELEGRAM_FORMAT.running} **Le temps reprend!**

Jour actuel: ${monde.jour_actuel}

Les cycles automatiques sont actifs.
Prochain cycle: dans ~1h`, { parse_mode: 'Markdown' })

    } catch (error) {
      await ctx.reply(`${TELEGRAM_FORMAT.error} Erreur: ${(error as Error).message}`)
    }
  })
}
