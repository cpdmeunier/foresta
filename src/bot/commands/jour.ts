/**
 * Foresta V2 - /jour Command
 * Forcer le passage d'un jour (cycle manuel)
 */

import type { Telegraf } from 'telegraf'
import { runCycle } from '../../engine/orchestrator.js'
import { getMonde } from '../../db/queries/monde.js'
import { TELEGRAM_FORMAT } from '../../types/commands.js'

export function registerJourCommand(bot: Telegraf): void {
  bot.command('jour', async (ctx) => {
    try {
      const monde = await getMonde()

      await ctx.reply(`${TELEGRAM_FORMAT.jour} Forçage du cycle jour ${monde.jour_actuel}...`)

      const result = await runCycle()

      if (result.success) {
        const degradedNote = result.degraded ? ` ${TELEGRAM_FORMAT.warning} (mode dégradé)` : ''

        await ctx.reply(`${TELEGRAM_FORMAT.success} Jour ${result.jour} terminé!${degradedNote}

Personnages traités: ${result.execute?.decisions.length || 0}
Skippés: ${result.execute?.skipped.length || 0}
Destins recalculés: ${result.resolve?.destins_recalcules.length || 0}`, { parse_mode: 'Markdown' })
      } else {
        await ctx.reply(`${TELEGRAM_FORMAT.warning} Cycle non exécuté: ${result.error}`)
      }

    } catch (error) {
      await ctx.reply(`${TELEGRAM_FORMAT.error} Erreur: ${(error as Error).message}`)
    }
  })
}
