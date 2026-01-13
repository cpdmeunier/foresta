/**
 * Foresta V2 - Auth Middleware
 * Only allow authorized chat ID (démiurge)
 */

import type { Context, MiddlewareFn } from 'telegraf'

export function createAuthMiddleware(): MiddlewareFn<Context> {
  const authorizedChatId = process.env.AUTHORIZED_CHAT_ID

  if (!authorizedChatId) {
    console.warn('⚠️ AUTHORIZED_CHAT_ID not set - all users will be denied')
  }

  return async (ctx, next) => {
    const chatId = ctx.chat?.id?.toString()

    if (!chatId || chatId !== authorizedChatId) {
      await ctx.reply('⛔ Accès non autorisé')
      return
    }

    return next()
  }
}
