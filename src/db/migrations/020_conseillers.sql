-- =========================================================================
-- MODULE : CONSEILLERS EN ACCOMPAGNEMENT (annuaire interne, admin)
-- =========================================================================

CREATE TABLE IF NOT EXISTS conseillers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom VARCHAR(150) NOT NULL,
    email VARCHAR(255),
    telephone VARCHAR(30),
    specialite VARCHAR(150),
    bio TEXT,

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_conseillers_active ON conseillers(is_active) WHERE deleted_at IS NULL;
