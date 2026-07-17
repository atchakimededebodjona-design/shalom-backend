-- Migration: create_community_tools_module

-- 1. Annuaire des groupes/cellules de prière
-- Extension de la table `groups` existante (on ajoute une catégorisation plutôt
-- que dupliquer la table). Structure réelle de `groups` à ce jour :
--   id, name, description, cover_url, visibility (enum group_visibility),
--   created_by, members_count, created_at, deleted_at
-- NB : `visibility` existe déjà et régit la confidentialité du groupe. Le champ
-- `is_directory_visible` ajouté ici ne fait qu'exprimer le souhait de figurer
-- dans l'annuaire ; l'annuaire exclut malgré tout les groupes `prive` afin de
-- ne pas contourner le modèle de visibilité en place (cf. groups.service.js).

ALTER TABLE groups ADD COLUMN IF NOT EXISTS group_category VARCHAR(30)
  CHECK (group_category IN ('cellule_priere','etude_biblique','jeunesse','autre') OR group_category IS NULL);

ALTER TABLE groups ADD COLUMN IF NOT EXISTS meeting_schedule VARCHAR(200); -- ex: "Tous les mardis 18h"
ALTER TABLE groups ADD COLUMN IF NOT EXISTS location_info TEXT; -- adresse ou lien visio
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_directory_visible BOOLEAN DEFAULT true;

-- 2. Calendrier des événements CAMAJ/SHALOM
CREATE TABLE community_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  event_type VARCHAR(30) CHECK (event_type IN ('retraite','formation','conference','autre')),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  location_info TEXT,
  cover_image_url TEXT,
  organizer_id UUID REFERENCES users(id),
  group_id UUID REFERENCES groups(id), -- NULL si événement global CAMAJ/SHALOM
  max_participants INTEGER,
  registration_required BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming','ongoing','completed','cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_community_events_date ON community_events(start_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_community_events_group ON community_events(group_id) WHERE deleted_at IS NULL;

-- Inscriptions aux événements
CREATE TABLE event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'registered' CHECK (status IN ('registered','attended','cancelled')),
  registered_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- 3. Demandes de prière partagées (distinct du carnet de prière personnel déjà créé)
CREATE TABLE shared_prayer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id), -- NULL = visible publiquement à toute la communauté
  visibility VARCHAR(20) DEFAULT 'group' CHECK (visibility IN ('public','group')),
  title VARCHAR(150) NOT NULL,
  description TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','answered','closed')),
  answered_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_shared_prayers_group ON shared_prayer_requests(group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_shared_prayers_visibility ON shared_prayer_requests(visibility) WHERE deleted_at IS NULL;

-- Réactions "je prie pour toi" sur les demandes partagées
CREATE TABLE prayer_request_supports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer_request_id UUID NOT NULL REFERENCES shared_prayer_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(prayer_request_id, user_id)
);

-- 4. Annonces communautaires épinglées
CREATE TABLE community_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  group_id UUID REFERENCES groups(id), -- NULL = annonce globale
  posted_by UUID NOT NULL REFERENCES users(id),
  is_pinned BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- pour ordonner plusieurs annonces épinglées
  expires_at TIMESTAMPTZ, -- optionnel: dépublication automatique
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_announcements_group ON community_announcements(group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_announcements_pinned ON community_announcements(is_pinned, priority) WHERE deleted_at IS NULL;

-- Triggers updated_at (réutilise la fonction créée par 004_finance_module)
CREATE TRIGGER trg_community_events_updated_at
  BEFORE UPDATE ON community_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_shared_prayers_updated_at
  BEFORE UPDATE ON shared_prayer_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON community_announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
