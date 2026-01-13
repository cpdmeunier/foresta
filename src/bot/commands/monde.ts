/**
 * Foresta V2 - /monde Command
 * État global du monde
 */

import type { Telegraf } from 'telegraf'
import { getMonde } from '../../db/queries/monde.js'
import { getAllPersonnages } from '../../db/queries/personnages.js'
import { getAllTerritoires } from '../../db/queries/territoires.js'
import { getEvenementsActifs } from '../../db/queries/evenements.js'
import { TELEGRAM_FORMAT } from '../../types/commands.js'

export function registerMondeCommand(bot: Telegraf): void {
  bot.command('monde', async (ctx) => {
    try {
      const [monde, personnages, territoires, evenements] = await Promise.all([
        getMonde(),
        getAllPersonnages(),
        getAllTerritoires(),
        getEvenementsActifs()
      ])

      const vivants = personnages.filter(p => p.vivant)
      const morts = personnages.filter(p => !p.vivant)

      const status = monde.paused ? `${TELEGRAM_FORMAT.paused} En pause` : `${TELEGRAM_FORMAT.running} Actif`

      // Territory status
      const territoireStats = territoires.map(t => {
        const count = vivants.filter(p => p.position === t.nom).length
        const evtCount = evenements.filter(e => e.zone_impact.includes(t.nom)).length
        const evtIndicator = evtCount > 0 ? ` ${TELEGRAM_FORMAT.evenement}${evtCount}` : ''
        return `  • ${t.nom}: ${count} hab.${evtIndicator}`
      }).join('\n')

      // Events list
      let eventsInfo = 'Aucun'
      if (evenements.length > 0) {
        eventsInfo = evenements
          .map(e => `  • ${e.type} (${e.zone_impact.join(', ')})`)
          .join('\n')
      }

      const lastCycle = monde.last_cycle_at
        ? new Date(monde.last_cycle_at).toLocaleString('fr-FR')
        : 'Jamais'

      const message = `${TELEGRAM_FORMAT.jour} **FORESTA - Jour ${monde.jour_actuel}**
${status}

**Population:**
  ${TELEGRAM_FORMAT.vivant} Vivants: ${vivants.length}
  ${TELEGRAM_FORMAT.mort} Morts: ${morts.length}

**Territoires:**
${territoireStats}

**Événements actifs:**
${eventsInfo}

_Dernier cycle: ${lastCycle}_`

      await ctx.reply(message, { parse_mode: 'Markdown' })
    } catch (error) {
      await ctx.reply(`${TELEGRAM_FORMAT.error} Erreur: ${(error as Error).message}`)
    }
  })
}
