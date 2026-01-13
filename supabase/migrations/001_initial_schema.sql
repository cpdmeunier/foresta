-- Foresta V2 - Initial Schema
-- 6 tables: monde, territoires, personnages, evenements, journal, cycle_lock

-- ============================================
-- TABLE: monde (singleton - état global)
-- ============================================
CREATE TABLE monde (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jour_actuel INTEGER NOT NULL DEFAULT 1,
  paused BOOLEAN NOT NULL DEFAULT TRUE,
  last_cycle_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert singleton monde (paused, waiting for /play)
INSERT INTO monde (jour_actuel, paused, last_cycle_at)
VALUES (1, TRUE, NULL);

-- ============================================
-- TABLE: territoires (lieux du monde)
-- ============================================
CREATE TABLE territoires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL UNIQUE,
  description TEXT,
  connexions TEXT[] NOT NULL DEFAULT '{}',
  etat TEXT NOT NULL DEFAULT 'normal',
  effets_actifs JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert les 5 territoires initiaux
INSERT INTO territoires (nom, description, connexions) VALUES
  ('heda', 'La forêt ancestrale, dense et mystérieuse', ARRAY['veda', 'luna']),
  ('veda', 'Les marais brumeux, terre de secrets', ARRAY['heda', 'roga']),
  ('luna', 'Les montagnes escarpées, refuge des solitaires', ARRAY['heda', 'muna']),
  ('roga', 'La prairie ouverte, lieu de rencontres', ARRAY['veda', 'muna']),
  ('muna', 'La rivière sinueuse, source de vie', ARRAY['luna', 'roga']);

-- ============================================
-- TABLE: personnages (habitants du monde)
-- ============================================
CREATE TABLE personnages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL UNIQUE,
  traits TEXT[] NOT NULL DEFAULT '{}',
  position TEXT NOT NULL DEFAULT 'heda',
  age INTEGER NOT NULL DEFAULT 0,
  vivant BOOLEAN NOT NULL DEFAULT TRUE,
  destin JSONB,
  journees_recentes JSONB NOT NULL DEFAULT '[]',
  relations JSONB NOT NULL DEFAULT '[]',
  in_conversation BOOLEAN NOT NULL DEFAULT FALSE,
  in_conversation_since TIMESTAMPTZ,
  derniere_action JSONB,
  jour_derniere_action INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_position FOREIGN KEY (position) REFERENCES territoires(nom)
);

-- Index for alive characters lookup
CREATE INDEX idx_personnages_vivant ON personnages(vivant) WHERE vivant = TRUE;

-- ============================================
-- TABLE: evenements (événements actifs)
-- ============================================
CREATE TABLE evenements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  zone_impact TEXT[] NOT NULL DEFAULT '{}',
  progression INTEGER NOT NULL DEFAULT 0,
  jour_debut INTEGER NOT NULL,
  jour_resolution INTEGER,
  actif BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for active events
CREATE INDEX idx_evenements_actif ON evenements(actif) WHERE actif = TRUE;

-- ============================================
-- TABLE: journal (chronique des jours)
-- ============================================
CREATE TABLE journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jour INTEGER NOT NULL UNIQUE,
  resume TEXT NOT NULL,
  degraded_day BOOLEAN NOT NULL DEFAULT FALSE,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for journal lookup by day
CREATE INDEX idx_journal_jour ON journal(jour);

-- ============================================
-- TABLE: cycle_lock (anti-drift CRON)
-- ============================================
CREATE TABLE cycle_lock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  processed_character_ids UUID[] NOT NULL DEFAULT '{}',

  CONSTRAINT valid_state CHECK (state IN ('running', 'complete', 'failed'))
);

-- Index for finding active locks
CREATE INDEX idx_cycle_lock_active ON cycle_lock(day_number, state) WHERE state = 'running';

-- ============================================
-- TRIGGERS: updated_at auto-update
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_monde_updated_at
  BEFORE UPDATE ON monde
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_territoires_updated_at
  BEFORE UPDATE ON territoires
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_personnages_updated_at
  BEFORE UPDATE ON personnages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_evenements_updated_at
  BEFORE UPDATE ON evenements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
