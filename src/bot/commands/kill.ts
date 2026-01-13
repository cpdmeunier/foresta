/**
 * Foresta V2 - /kill Command
 * Tuer un personnage
 */

import type { Telegraf } from 'telegraf'
import { getPersonnageByNom, killPersonnage } from '../../db/queries/personnages.js'
import { TELEGRAM_FORMAT } from '../../types/commands.js'

export function registerKillCommand(bot: Telegraf): void {
  bot.command('kill', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1)
    const nom = args.join(' ').trim()

    if (!nom) {
      await ctx.reply(`Usage: /kill [nom du personnage]`)
      return
    }

    try {
      const personnage = await getPersonnageByNom(nom)

      if (!personnage.vivant) {
        await ctx.reply(`${TELEGRAM_FORMAT.mort} ${personnage.nom} est déjà mort.`)
        return
      }

      // Kill the character
      await killPersonnage(personnage.id)

      const destinyEnd = personnage.destin
        ? `\n\n_Son destin prédisait: "${personnage.destin.fin_ecrite}"_`
        : ''

      await ctx.reply(`${TELEGRAM_FORMAT.mort} **${personnage.nom} est mort.**

Âge: ${personnage.age} jours
Dernier lieu: ${personnage.position}${destinyEnd}`, { parse_mode: 'Markdown' })

    } catch (error) {
      await ctx.reply(`${TELEGRAM_FORMAT.error} Personnage "${nom}" non trouvé.`)
    }
  })
}
