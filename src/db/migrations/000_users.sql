-- ============================================================
-- SHALOM — Migration 000 : Table Users (authentification)
-- Doit être exécutée AVANT la migration 001 (réseau social)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- Type ENUM pour les rôles utilisateur
-- ------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('user', 'moderateur', 'admin');

-- ------------------------------------------------------------
-- Table principale des utilisateurs
-- ------------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    role            user_role NOT NULL DEFAULT 'user',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    refresh_token   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

-- Index pour les recherches fréquentes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active) WHERE deleted_at IS NULL;

-- ============================================================
-- Fin de la migration 000
-- ============================================================
