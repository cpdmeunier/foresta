/**
 * Foresta V2 - /destins Command
 * Progression des destins
 */

import type { Telegraf } from 'telegraf'
import { getPersonnagesVivants } from '../../db/queries/personnages.js'
import { getMonde } from '../../db/queries/monde.js'
import { TELEGRAM_FORMAT } from '../../types/commands.js'

export function registerDestinsCommand(bot: Telegraf): void {
  bot.command('destins', async (ctx) => {
    try {
      const [monde, personnages] = await Promise.all([
        getMonde(),
        getPersonnagesVivants()
      ])

      if (personnages.length === 0) {
        await ctx.reply(`${TELEGRAM_FORMAT.destin} Aucun personnage vivant.`)
        return
      }

      const jourActuel = monde.jour_actuel

      const destinsInfo = personnages.map(p => {
        const { destin, nom, age } = p

        if (!destin) {
          return `${TELEGRAM_FORMAT.personnage} **${nom}** (${age}j)
  _Pas de destin tissé_`
        }

        // Find next palier
        const nextPalier = destin.paliers.find(pal => !pal.atteint)
        const paliersAtteints = destin.paliers.filter(pal => pal.atteint).length
        const totalPaliers = destin.paliers.length

        let palierInfo = '✨ Tous les paliers atteints'
        if (nextPalier) {
          const joursRestants = nextPalier.jour_cible - jourActuel
          const urgency = joursRestants <= 5 ? '⚡' : joursRestants <= 10 ? '⏳' : '📅'
          palierInfo = `${urgency} Prochain: J${nextPalier.jour_cible} (${joursRestants > 0 ? `dans ${joursRestants}j` : 'maintenant!'})`
        }

        const progressBar = Array(totalPaliers)
          .fill('○')
          .map((_, i) => i < paliersAtteints ? '●' : '○')
          .join('')

        return `${TELEGRAM_FORMAT.personnage} **${nom}** (${age}j)
  ${TELEGRAM_FORMAT.destin} _"${destin.inclination_actuelle}"_
  ${progressBar} ${paliersAtteints}/${totalPaliers}
  ${palierInfo}`
      }).join('\n\n')

      const message = `${TELEGRAM_FORMAT.destin} **DESTINS - Jour ${jourActuel}**

${destinsInfo}`

      await ctx.reply(message, { parse_mode: 'Markdown' })
    } catch (error) {
      await ctx.reply(`${TELEGRAM_FORMAT.error} Erreur: ${(error as Error).message}`)
    }
  })
}
