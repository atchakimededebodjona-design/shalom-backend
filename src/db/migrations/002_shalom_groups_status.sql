-- 002_shalom_groups_status.sql
-- Ajout du soft delete pour les groupes et du statut d'invitation pour les membres

ALTER TABLE groups ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE TYPE member_status AS ENUM ('actif', 'en_attente', 'refuse');
ALTER TABLE group_members ADD COLUMN status member_status NOT NULL DEFAULT 'actif';
