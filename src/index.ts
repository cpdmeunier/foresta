/**
 * Foresta V2 - Main Entry Point
 * Bot initialization and graceful shutdown
 */

import 'dotenv/config'

import { startBot, stopBot } from './bot/index.js'
import { startTriggerServer, stopTriggerServer } from './bot/routes/trigger-cycle.js'

// ============================================
// STARTUP
// ============================================
async function main(): Promise<void> {
  console.log('🌲 Foresta V2 - Starting...')
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`)

  // Validate required environment variables
  const required = [
    'TELEGRAM_BOT_TOKEN',
    'AUTHORIZED_CHAT_ID',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'ANTHROPIC_API_KEY'
  ]

  const missing = required.filter(key => !process.env[key])
  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing.join(', '))
    console.error('   Copy .env.example to .env and fill in the values')
    process.exit(1)
  }

  try {
    // Start trigger server for CRON
    startTriggerServer()

    // Start Telegram bot
    await startBot()

    console.log('✅ Foresta V2 is running!')
    console.log('   Bot: Ready')
    console.log(`   Trigger: http://localhost:${process.env.TRIGGER_PORT || 3001}/trigger`)

  } catch (error) {
    console.error('❌ Failed to start:', error)
    process.exit(1)
  }
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
async function shutdown(signal: string): Promise<void> {
  console.log(`\n🛑 Received ${signal}, shutting down...`)

  try {
    stopTriggerServer()
    await stopBot()
    console.log('👋 Foresta V2 stopped gracefully')
    process.exit(0)
  } catch (error) {
    console.error('Error during shutdown:', error)
    process.exit(1)
  }
}

// Register shutdown handlers
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

// Unhandled rejections
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
})

// Start the application
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
