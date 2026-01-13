/**
 * Foresta V2 - Supabase Edge Function for Cycle Trigger
 * Lightweight trigger that calls the main bot's trigger endpoint
 *
 * This Edge Function is designed to be called by pg_cron as a backup
 * or by an external CRON service.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BOT_TRIGGER_URL = Deno.env.get('BOT_TRIGGER_URL') || 'http://localhost:3001/trigger'
const TRIGGER_SECRET = Deno.env.get('TRIGGER_SECRET') || 'foresta-trigger'

serve(async (req) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  console.log('Edge Function: Triggering cycle on bot...')

  try {
    const response = await fetch(BOT_TRIGGER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TRIGGER_SECRET}`,
        'Content-Type': 'application/json'
      }
    })

    const result = await response.json()

    return new Response(JSON.stringify({
      triggered: true,
      botResponse: result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Failed to trigger bot:', error)

    return new Response(JSON.stringify({
      triggered: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
