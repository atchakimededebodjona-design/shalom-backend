-- 003_camaj_submissions.sql
-- Table unifiée des demandes issues des formulaires CAMAJ (mentor, programme,
-- mentorat, projet FAJ, don, relation d'aide). Champs communs en colonnes +
-- reste du formulaire en JSONB. Idempotent (réexécutable sans erreur).

DO $$ BEGIN
  CREATE TYPE camaj_submission_type AS ENUM (
    'mentor', 'programme', 'mentorat', 'faj', 'don', 'relation_aide'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE camaj_submission_status AS ENUM ('nouveau', 'traite', 'archive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS camaj_submissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type        camaj_submission_type NOT NULL,
    nom         VARCHAR(200),
    email       VARCHAR(255),
    whatsapp    VARCHAR(40),
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    status      camaj_submission_status NOT NULL DEFAULT 'nouveau',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_camaj_submissions_type ON camaj_submissions(type);
CREATE INDEX IF NOT EXISTS idx_camaj_submissions_created ON camaj_submissions(created_at DESC);
