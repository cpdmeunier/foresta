/**
 * Foresta V2 - /event Command
 * Créer un événement dans le monde
 */

import type { Telegraf } from 'telegraf'
import { createEvenement } from '../../db/queries/evenements.js'
import { getMonde } from '../../db/queries/monde.js'
import { getAllTerritoires } from '../../db/queries/territoires.js'
import { TELEGRAM_FORMAT } from '../../types/commands.js'
import type { EventType } from '../../types/commands.js'

// Sanitize user input for Markdown display
function sanitizeMarkdown(text: string): string {
  return text
    .replace(/[*_`\[\]()~>#+\-=|{}.!\\]/g, '\\$&')
    .slice(0, 500) // Limit length
}

const EVENT_TYPES: Record<EventType, { emoji: string; description: string }> = {
  catastrophe: { emoji: '🌋', description: 'Désastre naturel (tempête, tremblement, incendie)' },
  benediction: { emoji: '✨', description: 'Bénédiction divine, période de grâce' },
  migration: { emoji: '🦌', description: 'Arrivée de nouvelles créatures' },
  maladie: { emoji: '🦠', description: 'Épidémie ou mal étrange' },
  abondance: { emoji: '🍃', description: 'Période de prospérité et ressources' }
}

export function registerEventCommand(bot: Telegraf): void {
  bot.command('event', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1)

    if (args.length === 0) {
      // Show available event types
      const types = Object.entries(EVENT_TYPES)
        .map(([type, info]) => `${info.emoji} **${type}** - ${info.description}`)
        .join('\n')

      await ctx.reply(`${TELEGRAM_FORMAT.evenement} **Types d'événements:**

${types}

Usage: /event [type] [zones] [description]
Ex: /event catastrophe heda,veda Une tempête violente s'abat`, { parse_mode: 'Markdown' })
      return
    }

    try {
      const type = args[0].toLowerCase() as EventType

      if (!EVENT_TYPES[type]) {
        await ctx.reply(`${TELEGRAM_FORMAT.error} Type inconnu: ${type}`)
        return
      }

      if (args.length < 3) {
        await ctx.reply(`Usage: /event ${type} [zones] [description]
Ex: /event ${type} heda,veda Description de l'événement`)
        return
      }

      const zones = args[1].split(',').map(z => z.trim().toLowerCase())
      const rawDescription = args.slice(2).join(' ')
      const description = sanitizeMarkdown(rawDescription)

      // Validate zones
      const territoires = await getAllTerritoires()
      const validZones = zones.filter(z => territoires.some(t => t.nom === z))

      if (validZones.length === 0) {
        await ctx.reply(`${TELEGRAM_FORMAT.error} Aucune zone valide. Zones disponibles: ${territoires.map(t => t.nom).join(', ')}`)
        return
      }

      const monde = await getMonde()

      await createEvenement({
        type,
        description,
        zone_impact: validZones,
        jour_debut: monde.jour_actuel
      })

      const info = EVENT_TYPES[type]

      await ctx.reply(`${info.emoji} **Événement créé!**

Type: ${type}
Zones: ${validZones.join(', ')}
Description: _${description}_`, { parse_mode: 'Markdown' })

    } catch (error) {
      await ctx.reply(`${TELEGRAM_FORMAT.error} Erreur: ${(error as Error).message}`)
    }
  })
}
