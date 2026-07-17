-- Migration: create_spiritual_tools_module

-- 1. Plans de lecture biblique (catalogue de plans disponibles)
CREATE TABLE bible_reading_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(150) NOT NULL,
  description TEXT,
  duration_type VARCHAR(20) CHECK (duration_type IN ('daily','annual','custom')),
  total_days INTEGER NOT NULL,
  is_public BOOLEAN DEFAULT true, -- plan officiel vs créé par un user
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Contenu jour par jour d'un plan
CREATE TABLE bible_reading_plan_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES bible_reading_plans(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  passages TEXT NOT NULL, -- ex: "Genèse 1-3; Psaume 1"
  UNIQUE(plan_id, day_number)
);

-- Progression d'un utilisateur sur un plan
CREATE TABLE user_reading_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES bible_reading_plans(id),
  current_day INTEGER DEFAULT 1,
  started_at TIMESTAMPTZ DEFAULT now(),
  last_completed_at TIMESTAMPTZ,
  streak_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
  UNIQUE(user_id, plan_id)
);

-- Historique des jours cochés (pour calendrier/streak)
CREATE TABLE user_reading_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES bible_reading_plans(id),
  day_number INTEGER NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, plan_id, day_number)
);

-- 2. Carnet de prière
CREATE TABLE prayer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  category VARCHAR(50), -- famille, santé, travail, église, etc.
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','answered','ongoing')),
  answered_note TEXT, -- description de la réponse reçue
  answered_at TIMESTAMPTZ,
  reminder_frequency VARCHAR(20) CHECK (reminder_frequency IN ('daily','weekly','none')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_prayer_requests_user_status ON prayer_requests(user_id, status) WHERE deleted_at IS NULL;

-- 3. Versets/citations du jour
CREATE TABLE daily_verses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  reference VARCHAR(100), -- ex: "Jean 3:16", NULL si citation
  type VARCHAR(20) CHECK (type IN ('verse','quote')),
  display_date DATE, -- si assigné à une date précise, sinon rotation aléatoire
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Suivi des versets vus/favoris par utilisateur
CREATE TABLE user_verse_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verse_id UUID NOT NULL REFERENCES daily_verses(id),
  is_favorite BOOLEAN DEFAULT false,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, verse_id)
);

-- 4. Journal spirituel
CREATE TABLE spiritual_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_type VARCHAR(20) DEFAULT 'note' CHECK (entry_type IN ('note','gratitude')),
  content TEXT NOT NULL,
  mood VARCHAR(30), -- optionnel: reconnaissant, en paix, en lutte, etc.
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_journal_user_date ON spiritual_journal_entries(user_id, entry_date) WHERE deleted_at IS NULL;

-- 5. Chants/louanges
CREATE TABLE worship_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  artist_or_author VARCHAR(150),
  lyrics TEXT,
  language VARCHAR(10) DEFAULT 'fr',
  category VARCHAR(50), -- louange, adoration, cantique, etc.
  created_by UUID REFERENCES users(id),
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Playlists créées par les utilisateurs
CREATE TABLE worship_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Liaison playlist <-> chants (avec ordre)
CREATE TABLE worship_playlist_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES worship_playlists(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES worship_songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  UNIQUE(playlist_id, song_id)
);

-- Trigger updated_at (réutilise la fonction créée par la migration 004_finance_module)
CREATE TRIGGER trg_prayer_requests_updated_at
  BEFORE UPDATE ON prayer_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_journal_entries_updated_at
  BEFORE UPDATE ON spiritual_journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
