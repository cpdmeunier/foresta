# Foresta V2

Simulation narrative autonome via Telegram. Des personnages vivent, explorent, et prennent leurs propres décisions. Tu les observes et leur parles dans leurs rêves.

## Concept

- **Tu crées** des personnages avec des traits de caractère
- **Ils vivent** de manière autonome (cycle CRON)
- **Tu observes** via `/look`
- **Tu conseilles** via `/conseiller` (dans leurs rêves)
- **Ils décident** librement - peuvent ignorer tes conseils

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         TELEGRAM BOT                             │
│                    (src/bot/index.ts)                            │
│  Commandes: /create /look /conseiller /monde /destins /jour...  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATEUR                             │
│                  (src/engine/orchestrator.ts)                    │
│                                                                  │
│  Pipeline 6 étapes:                                              │
│  COLLECT → ANALYZE → EXECUTE → RESOLVE → NOTIFY → LOG           │
│                                                                  │
│  • Code TypeScript (PAS un LLM)                                  │
│  • Gère le cycle jour/nuit                                       │
│  • Filtre les données avant d'appeler Claude                     │
│  • Applique les résultats dans la DB                             │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────┐        ┌──────────────────────┐
│      SUPABASE        │        │    CLAUDE (LLM)      │
│   (PostgreSQL)       │        │  (Anthropic API)     │
│                      │        │                      │
│  • monde             │        │  • Génère actions    │
│  • territoires       │        │  • Génère destins    │
│  • personnages       │        │  • Génère dialogues  │
│  • evenements        │        │                      │
│  • journal           │        │  Reçoit SEULEMENT    │
│  • cycle_lock        │        │  ce que le perso     │
│                      │        │  sait (filtré)       │
└──────────────────────┘        └──────────────────────┘
```

## Structure des fichiers

```
foresta-v2/
├── src/
│   ├── index.ts                    # Point d'entrée
│   ├── bot/
│   │   ├── index.ts                # Setup Telegraf
│   │   ├── middleware/
│   │   │   └── auth.ts             # Authentification Démiurge
│   │   ├── commands/
│   │   │   ├── create.ts           # /create - créer un personnage
│   │   │   ├── look.ts             # /look - observer
│   │   │   ├── conseiller.ts       # /conseiller - parler dans les rêves
│   │   │   ├── monde.ts            # /monde - état global
│   │   │   ├── destins.ts          # /destins - progression des destins
│   │   │   ├── jour.ts             # /jour - forcer un jour
│   │   │   ├── pause.ts            # /pause - mettre en pause
│   │   │   ├── play.ts             # /play - reprendre
│   │   │   ├── event.ts            # /event - créer événement
│   │   │   └── kill.ts             # /kill - tuer un personnage
│   │   └── routes/
│   │       └── trigger-cycle.ts    # Endpoint HTTP pour CRON
│   │
│   ├── engine/
│   │   ├── orchestrator.ts         # Pipeline principal du cycle
│   │   ├── actions.ts              # Génération d'actions via LLM
│   │   ├── destiny.ts              # Gestion des destins
│   │   └── validation.ts           # Validation des réponses LLM
│   │
│   ├── db/
│   │   ├── client.ts               # Client Supabase
│   │   └── queries/
│   │       ├── monde.ts            # CRUD monde
│   │       ├── territoires.ts      # CRUD territoires
│   │       ├── personnages.ts      # CRUD personnages
│   │       ├── evenements.ts       # CRUD événements
│   │       ├── journal.ts          # CRUD journal
│   │       └── cycle-lock.ts       # Verrous anti-drift
│   │
│   ├── llm/
│   │   ├── client.ts               # Client Claude avec retry
│   │   ├── templates.ts            # Actions template (fallback)
│   │   └── prompts/
│   │       ├── personnage.ts       # Prompts actions quotidiennes
│   │       ├── destin.ts           # Prompts création/recalcul destin
│   │       └── resume.ts           # Prompts résumé journalier
│   │
│   └── types/
│       ├── entities.ts             # Types DB (Monde, Personnage, etc.)
│       ├── orchestrator.ts         # Types pipeline
│       └── commands.ts             # Types commandes Telegram
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Schéma DB
│
└── docs/
    └── CRON_SETUP.md               # Config CRON externe
```

## Pipeline Orchestrateur

Le cycle quotidien suit 6 étapes:

### 1. COLLECT
Récupère l'état actuel:
- Monde (jour, paused)
- Personnages vivants
- Territoires
- Événements actifs

### 2. ANALYZE
Analyse les tensions:
- Personnages en danger
- Paliers de destin approchant
- Conflits potentiels

### 3. EXECUTE
Pour chaque personnage:
1. Génère le contexte (SEULEMENT ce qu'il sait)
2. Appelle Claude pour décider son action
3. Valide la réponse (lieu accessible, cible existante)
4. Fallback sur template si LLM échoue

### 4. RESOLVE
Applique les conséquences:
- Déplace les personnages
- Met à jour les relations
- Vérifie/recalcule les destins
- Marque les paliers atteints

### 5. NOTIFY
Envoie les notifications Telegram:
- Résumé du jour
- Alertes (mort, palier atteint)

### 6. LOG
Crée l'entrée journal:
- Résumé généré par LLM
- Détails des actions
- Flag degraded si LLM indisponible

## Base de données

### Tables

| Table | Description |
|-------|-------------|
| `monde` | Singleton - état global (jour, paused) |
| `territoires` | Les 5 régions (heda, veda, luna, roga, muna) |
| `personnages` | Habitants avec traits, position, destin, relations |
| `evenements` | Événements actifs (météo, catastrophes) |
| `journal` | Chronique des jours passés |
| `cycle_lock` | Verrous anti-drift CRON |

### Territoires

| Nom | Description | Danger |
|-----|-------------|--------|
| **heda** | Forêt tranquille et sûre | Safe (départ) |
| **veda** | Vallée aux cratères toxiques | Rend fou |
| **luna** | Montagnes avec monstres | Danger mortel |
| **roga** | Désert chaud et aride | Survie difficile |
| **muna** | Terres glacées | Froid mortel |

### Personnage - Structure

```typescript
{
  nom: string
  traits: string[]           // Ex: ["curieux", "prudent"]
  position: string           // Territoire actuel
  age: number                // Jours vécus
  vivant: boolean
  destin: {
    fin_ecrite: string       // Comment sa vie se termine
    inclination_actuelle: string
    paliers: [
      { jour_cible: 25, description: string, atteint: boolean }
    ]
  }
  journees_recentes: [       // Dernières actions
    { jour: 1, action: "...", lieu: "heda", interactions: [] }
  ]
  relations: [
    { personnage_id, personnage_nom, type: "ami"|"rival"|"connaissance", intensite }
  ]
  in_conversation: boolean   // Bloque le cycle pendant /conseiller
}
```

## Prompts LLM

### Principe fondamental

> **L'orchestrateur est omniscient. Claude ne reçoit QUE ce que le personnage sait.**

### personnage.ts - Actions quotidiennes

**System prompt:**
```
Tu décides ce qu'un personnage fait aujourd'hui, basé UNIQUEMENT sur ce qu'il sait.

Le personnage ne connaît QUE:
- L'endroit où il se trouve
- Les endroits qu'il a visités
- Ce qu'il voit autour de lui
```

**User prompt (filtré):**
```
JOUR 5

PERSONNAGE: Prunelle
TRAITS: curieux, prudent
ÂGE: 5 jours

OÙ IL EST: heda
Forêt tranquille et sûre.

QUI IL VOIT:
Personne d'autre

CHEMINS POSSIBLES:
- Un chemin mène vers veda
- Un chemin mène vers luna

Que fait Prunelle aujourd'hui?
```

### conseiller.ts - Dialogues

**System prompt:**
```
Tu es [nom]. Tu parles à ton conseiller (une voix dans tes rêves).

CE QUE TU SAIS:
- Traits: curieux, prudent
- Âge: 5 jours
- Tu es à: heda
- Tu n'as rencontré personne
- Tu es seul(e)
- Tu viens d'arriver dans ce monde

IMPORTANT:
- Tu ne connais QUE ce qui est listé
- Pas de famille, pas de village, pas de souvenirs inventés
```

### Style obligatoire

```
INTERDIT:
- Poésie, métaphores fleuries
- Mots pompeux (écarlate, ancestral, murmure)
- Ton poli et générique

OBLIGATOIRE:
- Direct et concret
- Humour/sarcasme autorisé
- Chaque personnage a SA voix selon ses traits
```

## Commandes Telegram

| Commande | Description |
|----------|-------------|
| `/create [nom]` | Créer un nouveau personnage |
| `/look` | Vue d'ensemble du monde |
| `/look [nom]` | Observer un personnage spécifique |
| `/conseiller [nom]` | Parler à un personnage (dans ses rêves) |
| `/fin` | Terminer une conversation |
| `/monde` | État détaillé du monde |
| `/destins` | Progression des destins |
| `/jour` | Forcer le passage d'un jour |
| `/pause` | Mettre le monde en pause |
| `/play` | Reprendre le temps |
| `/event [desc]` | Créer un événement |
| `/kill [nom]` | Tuer un personnage |
| `/help` | Liste des commandes |

## Installation

### Prérequis

- Node.js 18+
- Compte Supabase
- Bot Telegram (via BotFather)
- Clé API Anthropic

### Configuration

1. **Cloner et installer:**
```bash
git clone https://github.com/cpdmeunier/foresta.git
cd foresta-v2
npm install
```

2. **Configurer `.env`:**
```env
# Telegram
TELEGRAM_BOT_TOKEN=xxx
AUTHORIZED_CHAT_ID=xxx

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Trigger
TRIGGER_SECRET=xxx
NODE_ENV=development
```

3. **Appliquer le schéma Supabase:**
```sql
-- Exécuter dans Supabase SQL Editor:
-- supabase/migrations/001_initial_schema.sql
```

4. **Lancer en local:**
```bash
npm run dev
```

### Déploiement Railway

```bash
railway login
railway init
railway variables set TELEGRAM_BOT_TOKEN="..."
railway variables set AUTHORIZED_CHAT_ID="..."
railway variables set SUPABASE_URL="..."
railway variables set SUPABASE_SERVICE_KEY="..."
railway variables set ANTHROPIC_API_KEY="..."
railway variables set TRIGGER_SECRET="..."
railway variables set NODE_ENV="production"
railway up
```

## Trigger CRON

Le cycle peut être déclenché par:

1. **Commande `/jour`** - Manuel
2. **Endpoint HTTP** - Pour CRON externe

```bash
curl -X POST https://your-app.railway.app/trigger \
  -H "Authorization: Bearer YOUR_TRIGGER_SECRET"
```

Réponse:
```json
{
  "success": true,
  "jour": 5,
  "state": "complete",
  "degraded": false,
  "stats": { "decisions": 3, "skipped": 0 }
}
```

## Tests

```bash
npm test              # Run tous les tests
npm run test:watch    # Mode watch
```

## Développement

### Ajouter une commande

1. Créer `src/bot/commands/macommande.ts`
2. Exporter `registerMaCommandeCommand(bot)`
3. Importer et appeler dans `src/bot/index.ts`

### Modifier un prompt

Les prompts sont dans `src/llm/prompts/`:
- `personnage.ts` - Actions quotidiennes
- `destin.ts` - Création/recalcul destin
- `resume.ts` - Résumé journalier

**Règle:** Claude ne doit recevoir QUE ce que le personnage sait.

## Liens

- **Repository:** https://github.com/cpdmeunier/foresta
- **Railway:** https://railway.com/project/...
- **Supabase:** https://supabase.com/dashboard/project/...
- **Bot Telegram:** @ForestaMVP_bot

---

*Foresta V2 - Un monde où tu observes, conseilles, mais ne contrôles jamais.*
