# Foresta V2 - Configuration CRON

Le cycle automatique (1h réel = 1 jour Foresta) nécessite un CRON externe.

## Architecture

```
CRON externe (toutes les heures)
       ↓
Bot Trigger Endpoint (:3001/trigger)
       ↓
Orchestrator.runCycle()
```

## Option A: Railway (Recommandé)

### 1. Déployer le bot sur Railway

```bash
# Dans le dossier foresta-v2
railway init
railway up
```

### 2. Configurer les variables d'environnement

```
TELEGRAM_BOT_TOKEN=xxx
AUTHORIZED_CHAT_ID=xxx
SUPABASE_URL=xxx
SUPABASE_SERVICE_KEY=xxx
ANTHROPIC_API_KEY=xxx
TRIGGER_SECRET=xxx
TRIGGER_PORT=3001
```

### 3. Configurer le CRON Railway

Dans le fichier `railway.toml`:

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"
healthcheckPath = "/health"
healthcheckTimeout = 300

[[crons]]
name = "foresta-cycle"
schedule = "0 * * * *"  # Toutes les heures
endpoint = "POST /trigger"
headers = { Authorization = "Bearer ${TRIGGER_SECRET}" }
```

## Option B: Vercel CRON

### 1. Créer un endpoint API

Créer `api/trigger.ts`:

```typescript
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  const response = await fetch(process.env.BOT_TRIGGER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.TRIGGER_SECRET}`
    }
  })

  const result = await response.json()
  return res.json(result)
}
```

### 2. Configurer vercel.json

```json
{
  "crons": [{
    "path": "/api/trigger",
    "schedule": "0 * * * *"
  }]
}
```

## Option C: pg_cron (Backup)

Si le CRON externe échoue, pg_cron dans Supabase peut servir de backup.

### 1. Activer pg_cron dans Supabase

Dashboard → Extensions → pg_cron

### 2. Créer le job CRON

```sql
SELECT cron.schedule(
  'foresta-cycle-backup',
  '5 * * * *',  -- 5 min après l'heure (backup)
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/cycle',
    headers := '{"Authorization": "Bearer xxx"}'::jsonb
  );
  $$
);
```

## Monitoring

### Vérifier les cycles

```sql
SELECT * FROM journal
ORDER BY jour DESC
LIMIT 10;
```

### Vérifier les locks

```sql
SELECT * FROM cycle_lock
WHERE started_at > NOW() - INTERVAL '24 hours'
ORDER BY started_at DESC;
```

## Troubleshooting

### Cycle ne se déclenche pas

1. Vérifier que `monde.paused = false`
2. Vérifier les logs du bot
3. Vérifier que le CRON est bien configuré
4. Vérifier le TRIGGER_SECRET

### Cycle bloqué

1. Vérifier `cycle_lock` pour un lock actif
2. Si lock > 30min, il sera auto-relâché au prochain cycle
3. Manuellement: `UPDATE cycle_lock SET state = 'failed' WHERE state = 'running'`

### LLM en mode dégradé

1. Vérifier ANTHROPIC_API_KEY
2. Vérifier les quotas API
3. Les jours dégradés sont marqués `degraded_day = true` dans le journal
