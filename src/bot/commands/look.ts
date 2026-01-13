/**
 * Foresta V2 - /look Command
 * Observer un personnage ou le monde
 */

import type { Telegraf, Context } from 'telegraf'
import { getPersonnageByNom, getPersonnagesAtPosition } from '../../db/queries/personnages.js'
import { getTerritoireByNom } from '../../db/queries/territoires.js'
import { getEvenementsAtZone } from '../../db/queries/evenements.js'
import { getMonde } from '../../db/queries/monde.js'
import { TELEGRAM_FORMAT } from '../../types/commands.js'

export function registerLookCommand(bot: Telegraf): void {
  bot.command('look', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1)
    const nom = args.join(' ').trim()

    if (!nom) {
      // Look at the world overview
      await lookWorld(ctx)
    } else {
      // Look at specific character
      await lookPersonnage(ctx, nom)
    }
  })
}

async function lookWorld(ctx: Context): Promise<void> {
  try {
    const monde = await getMonde()

    const status = monde.paused ? TELEGRAM_FORMAT.paused : TELEGRAM_FORMAT.running
    const message = `${TELEGRAM_FORMAT.jour} **Foresta - Jour ${monde.jour_actuel}** ${status}

Utilisez \`/look [nom]\` pour observer un personnage.
Utilisez \`/monde\` pour un état détaillé.`

    await ctx.reply(message, { parse_mode: 'Markdown' })
  } catch (error) {
    await ctx.reply(`${TELEGRAM_FORMAT.error} Erreur: ${(error as Error).message}`)
  }
}

async function lookPersonnage(ctx: Context, nom: string): Promise<void> {
  try {
    const personnage = await getPersonnageByNom(nom)
    const territoire = await getTerritoireByNom(personnage.position)
    const [presents, evenements] = await Promise.all([
      getPersonnagesAtPosition(personnage.position),
      getEvenementsAtZone(personnage.position)
    ])

    const otherPresents = presents.filter(p => p.id !== personnage.id)

    // Format traits
    const traits = personnage.traits.map(t => `\`${t}\``).join(', ')

    // Format destiny
    let destinyInfo = 'Pas de destin'
    if (personnage.destin) {
      const nextPalier = personnage.destin.paliers.find(p => !p.atteint)
      if (nextPalier) {
        destinyInfo = `🔮 _"${personnage.destin.inclination_actuelle}"_
Prochain palier: Jour ${nextPalier.jour_cible}`
      } else {
        destinyInfo = `🔮 _Tous les paliers atteints_`
      }
    }

    // Format relations
    let relationsInfo = 'Aucune relation'
    if (personnage.relations.length > 0) {
      relationsInfo = personnage.relations
        .slice(0, 3)
        .map(r => `${r.type === 'ami' ? '💚' : r.type === 'rival' ? '💔' : '🤝'} ${r.personnage_nom}`)
        .join(', ')
    }

    // Format dernière action
    let actionInfo = 'Aucune action récente'
    if (personnage.derniere_action) {
      actionInfo = personnage.derniere_action.narration
    }

    const vitalStatus = personnage.vivant ? TELEGRAM_FORMAT.vivant : TELEGRAM_FORMAT.mort

    const message = `${TELEGRAM_FORMAT.personnage} **${personnage.nom}** ${vitalStatus}

**Traits:** ${traits}
**Âge:** ${personnage.age} jours
**Position:** ${territoire.nom} - _${territoire.description}_

**Présents ici:** ${otherPresents.length > 0 ? otherPresents.map(p => p.nom).join(', ') : 'Personne d\'autre'}
**Événements:** ${evenements.length > 0 ? evenements.map(e => e.type).join(', ') : 'Aucun'}

${destinyInfo}

**Relations:** ${relationsInfo}

**Dernière action:**
_${actionInfo}_`

    await ctx.reply(message, { parse_mode: 'Markdown' })
  } catch (error) {
    await ctx.reply(`${TELEGRAM_FORMAT.error} Personnage "${nom}" non trouvé.`)
  }
}
