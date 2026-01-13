/**
 * Foresta V2 - Trigger Cycle HTTP Endpoint
 * Called by external CRON to run daily cycle
 */

import { createServer, IncomingMessage, ServerResponse } from 'http'
import { runCycle } from '../../engine/orchestrator.js'

const TRIGGER_SECRET = process.env.TRIGGER_SECRET || 'foresta-trigger'
const PORT = parseInt(process.env.TRIGGER_PORT || '3001', 10)

let server: ReturnType<typeof createServer> | null = null

export function startTriggerServer(): void {
  if (server) return

  server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Only accept POST /trigger
    if (req.method !== 'POST' || req.url !== '/trigger') {
      res.writeHead(404)
      res.end('Not Found')
      return
    }

    // Check secret in header
    const authHeader = req.headers.authorization
    if (authHeader !== `Bearer ${TRIGGER_SECRET}`) {
      res.writeHead(401)
      res.end('Unauthorized')
      return
    }

    console.log('🔔 Cycle trigger received')

    try {
      const result = await runCycle()

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        success: result.success,
        jour: result.jour,
        state: result.state,
        degraded: result.degraded,
        error: result.error,
        stats: result.execute ? {
          decisions: result.execute.decisions.length,
          skipped: result.execute.skipped.length
        } : null
      }))
    } catch (error) {
      console.error('Trigger cycle failed:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        success: false,
        error: (error as Error).message
      }))
    }
  })

  server.listen(PORT, () => {
    console.log(`🔌 Trigger server listening on port ${PORT}`)
  })
}

export function stopTriggerServer(): void {
  if (server) {
    server.close()
    server = null
  }
}
