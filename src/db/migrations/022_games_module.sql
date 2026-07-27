-- ============================================================================
-- Migration: 022_games_module.sql
-- Module: SHALOM Games — moteur de jeu générique (Phase 1 : quiz-based games)
-- Couvre: Quiz Biblique, Complète le verset, Qui suis-je ?
-- Conçu pour être réutilisé par les jeux visuels de la Phase 2 (puzzle,
-- memory, escape game) sans refonte du schéma de base.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Référentiel des jeux disponibles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS games (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(50) UNIQUE NOT NULL,      -- ex: 'quiz_biblique', 'complete_verset', 'qui_suis_je'
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    engine_type     VARCHAR(30) NOT NULL DEFAULT 'quiz', -- 'quiz' | 'puzzle' | 'memory' | 'escape' (Phase 2)
    icon_url        TEXT,
    config          JSONB DEFAULT '{}'::jsonb,        -- réglages spécifiques au jeu (durée round, vies, etc.)
    is_active       BOOLEAN NOT NULL DEFAULT true,
    display_order   INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

-- ----------------------------------------------------------------------------
-- 2. Catégories bibliques transversales (réutilisables entre jeux)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(60) UNIQUE NOT NULL,       -- 'ancien-testament', 'personnages', 'paraboles'...
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    display_order   INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

-- ----------------------------------------------------------------------------
-- 3. Banque de questions (partagée par tous les jeux de type "quiz")
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS questions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    category_id     UUID REFERENCES game_categories(id) ON DELETE SET NULL,
    question_type   VARCHAR(30) NOT NULL DEFAULT 'mcq', -- 'mcq' | 'fill_blank' | 'true_false' | 'image_guess'
    difficulty      SMALLINT NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3), -- 1=débutant 2=intermédiaire 3=expert
    prompt          TEXT NOT NULL,                     -- énoncé ("Qui a construit l'arche ?")
    media_url       TEXT,                              -- silhouette, image, illustration (optionnel)
    explanation     TEXT,                              -- référence biblique / explication affichée après réponse
    scripture_ref   VARCHAR(100),                       -- ex: 'Jean 3:16'
    base_points     INTEGER NOT NULL DEFAULT 10,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_questions_game_active ON questions (game_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions (category_id);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions (game_id, difficulty);

-- ----------------------------------------------------------------------------
-- 4. Choix de réponse (pour les questions à choix multiples)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS question_choices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id     UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    choice_text     VARCHAR(255) NOT NULL,
    is_correct      BOOLEAN NOT NULL DEFAULT false,
    display_order   SMALLINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_choices_question ON question_choices (question_id);

-- Contrainte applicative (pas SQL pure) : chaque question doit avoir exactement
-- une choice_id avec is_correct = true — à vérifier côté service à l'insertion,
-- Postgres ne peut pas l'exprimer proprement en contrainte déclarative.

-- ----------------------------------------------------------------------------
-- 5. Sessions de jeu (une partie jouée par un utilisateur)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    mode            VARCHAR(20) NOT NULL DEFAULT 'solo', -- 'solo' | 'duel' | 'tournament'
    difficulty      SMALLINT NOT NULL DEFAULT 1,
    status          VARCHAR(20) NOT NULL DEFAULT 'in_progress', -- 'in_progress' | 'completed' | 'abandoned'
    score           INTEGER NOT NULL DEFAULT 0,
    lives_remaining SMALLINT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at        TIMESTAMPTZ,
    metadata        JSONB DEFAULT '{}'::jsonb          -- ex: opponent_id pour un duel, tournament_id...
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON game_sessions (user_id, game_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON game_sessions (status);

-- ----------------------------------------------------------------------------
-- 6. Réponses données pendant une session (historique détaillé, anti-triche)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_answers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    question_id     UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    choice_id       UUID REFERENCES question_choices(id),
    is_correct      BOOLEAN NOT NULL,
    time_taken_ms   INTEGER,
    points_earned   INTEGER NOT NULL DEFAULT 0,
    answered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, question_id)                   -- une seule réponse par question par session
);

CREATE INDEX IF NOT EXISTS idx_session_answers_session ON session_answers (session_id);

-- ----------------------------------------------------------------------------
-- 7. Statistiques agrégées par utilisateur et par jeu (évite de recalculer
--    à chaque affichage de profil/classement)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_game_stats (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id             UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    total_sessions      INTEGER NOT NULL DEFAULT 0,
    best_score          INTEGER NOT NULL DEFAULT 0,
    total_points        INTEGER NOT NULL DEFAULT 0,
    current_streak_days INTEGER NOT NULL DEFAULT 0,
    longest_streak_days INTEGER NOT NULL DEFAULT 0,
    last_played_at      TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_user_game_stats_leaderboard ON user_game_stats (game_id, total_points DESC);

-- ----------------------------------------------------------------------------
-- 8. XP global — transversal à toute l'app (pas seulement les jeux), pour
--    éviter d'avoir un système de points isolé qui ne parle pas au reste
--    de SHALOM (Portefeuille, Outils, etc.)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_xp (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    total_xp        INTEGER NOT NULL DEFAULT 0,
    level           INTEGER NOT NULL DEFAULT 1,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS xp_transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount          INTEGER NOT NULL,                  -- peut être négatif si pénalité
    source_type     VARCHAR(50) NOT NULL,               -- 'game_session' | 'daily_challenge' | 'badge' ...
    source_id       UUID,                                -- ex: game_sessions.id
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_user ON xp_transactions (user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 9. Badges / succès
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS badges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(50) UNIQUE NOT NULL,        -- 'disciple', 'evangeliste', 'prophete', 'sage'
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    icon_url        TEXT,
    criteria        JSONB NOT NULL DEFAULT '{}'::jsonb, -- ex: {"type":"streak","min_days":7}
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_badges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id        UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    earned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, badge_id)
);

-- ----------------------------------------------------------------------------
-- 10. Défi quotidien
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_challenges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_date  DATE NOT NULL UNIQUE,
    game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    question_ids    UUID[] NOT NULL,                    -- liste ordonnée de questions du jour
    reward_xp       INTEGER NOT NULL DEFAULT 20,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_daily_challenge_progress (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_id    UUID NOT NULL REFERENCES daily_challenges(id) ON DELETE CASCADE,
    completed       BOOLEAN NOT NULL DEFAULT false,
    completed_at    TIMESTAMPTZ,
    UNIQUE (user_id, challenge_id)
);

-- ----------------------------------------------------------------------------
-- 11. Duels 1v1 ("Bataille Biblique") — extension légère de game_sessions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_duels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_one_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    player_two_id   UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL tant que personne n'a rejoint
    status          VARCHAR(20) NOT NULL DEFAULT 'waiting', -- 'waiting' | 'active' | 'completed' | 'cancelled'
    winner_id       UUID REFERENCES users(id),
    session_p1_id   UUID REFERENCES game_sessions(id),
    session_p2_id   UUID REFERENCES game_sessions(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_duels_status ON game_duels (status);

-- ----------------------------------------------------------------------------
-- 12. Vue matérialisée pour le classement global (rafraîchie périodiquement,
--     évite de recalculer un tri sur toute la table à chaque affichage)
-- ----------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS leaderboard_global AS
SELECT
    user_id,
    SUM(total_points) AS total_points,
    MAX(last_played_at) AS last_played_at,
    RANK() OVER (ORDER BY SUM(total_points) DESC) AS rank
FROM user_game_stats
GROUP BY user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_global_user ON leaderboard_global (user_id);

-- Rafraîchissement : à planifier via un job (ex: toutes les 15 min) —
-- REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_global;

-- ----------------------------------------------------------------------------
-- 13. Trigger updated_at générique (réutilise le pattern existant si déjà
--     défini ailleurs dans la base ; sinon le créer une seule fois)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_games_updated_at ON games;
CREATE TRIGGER trg_games_updated_at BEFORE UPDATE ON games
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_questions_updated_at ON questions;
CREATE TRIGGER trg_questions_updated_at BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Seed minimal : les 3 jeux du MVP (Phase 1)
-- ============================================================================
INSERT INTO games (code, name, description, engine_type, display_order) VALUES
    ('quiz_biblique', 'Quiz Biblique', 'Questions à choix multiples sur la Bible, plusieurs niveaux de difficulté.', 'quiz', 1),
    ('complete_verset', 'Complète le verset', 'Retrouve le mot manquant dans un verset biblique.', 'quiz', 2),
    ('qui_suis_je', 'Qui suis-je ?', 'Devine le personnage biblique à partir d''indices successifs.', 'quiz', 3)
ON CONFLICT (code) DO NOTHING;

INSERT INTO game_categories (slug, name, display_order) VALUES
    ('ancien-testament', 'Ancien Testament', 1),
    ('nouveau-testament', 'Nouveau Testament', 2),
    ('personnages', 'Personnages bibliques', 3),
    ('paraboles', 'Paraboles', 4),
    ('versets-cles', 'Versets clés', 5)
ON CONFLICT (slug) DO NOTHING;
