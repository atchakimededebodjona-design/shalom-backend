-- ============================================================
-- SHALOM — Migration 001 : Module Réseau Social
-- Ordre d'exécution corrigé pour Supabase / PostgreSQL
-- Prérequis : une table `users` doit déjà exister (module auth)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- 1. TYPES ENUM (tous créés en premier)
-- ------------------------------------------------------------
CREATE TYPE post_type AS ENUM ('texte', 'image', 'video', 'temoignage', 'priere', 'annonce');
CREATE TYPE post_status AS ENUM ('publie', 'signale', 'masque', 'supprime');
CREATE TYPE likeable_type AS ENUM ('post', 'comment');
CREATE TYPE group_visibility AS ENUM ('public', 'prive', 'sur_invitation');
CREATE TYPE group_role AS ENUM ('membre', 'moderateur', 'admin');
CREATE TYPE report_reason AS ENUM ('spam', 'contenu_inapproprie', 'harcelement', 'faux_compte', 'autre');
CREATE TYPE report_status AS ENUM ('en_attente', 'traite', 'rejete');
CREATE TYPE notification_type AS ENUM ('like', 'comment', 'follow', 'mention', 'groupe', 'systeme');
CREATE TYPE credit_reason AS ENUM ('invitation', 'engagement', 'achat', 'depense_mentorat', 'bonus_ambassadeur');

-- ------------------------------------------------------------
-- 2. PROFILS
-- ------------------------------------------------------------
CREATE TABLE profiles (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name    VARCHAR(100) NOT NULL,
    avatar_url      TEXT,
    cover_url       TEXT,
    bio             VARCHAR(500),
    country         VARCHAR(100),
    city            VARCHAR(100),
    church_name     VARCHAR(150),
    denomination    VARCHAR(100),
    plan            VARCHAR(20) NOT NULL DEFAULT 'free',
    is_ambassador   BOOLEAN NOT NULL DEFAULT FALSE,
    credits_balance INTEGER NOT NULL DEFAULT 0,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_denomination ON profiles(denomination);
CREATE INDEX idx_profiles_country ON profiles(country);

-- ------------------------------------------------------------
-- 3. GROUPES / COMMUNAUTÉS
-- ------------------------------------------------------------
CREATE TABLE groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    cover_url       TEXT,
    visibility      group_visibility NOT NULL DEFAULT 'public',
    created_by      UUID NOT NULL REFERENCES users(id),
    members_count   INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE group_members (
    group_id        UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            group_role NOT NULL DEFAULT 'membre',
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_group_members_user ON group_members(user_id);

-- ------------------------------------------------------------
-- 4. POSTS
-- ------------------------------------------------------------
CREATE TABLE posts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id        UUID REFERENCES groups(id) ON DELETE SET NULL,
    type            post_type NOT NULL DEFAULT 'texte',
    content         TEXT,
    media_url       TEXT,
    status          post_status NOT NULL DEFAULT 'publie',
    likes_count     INTEGER NOT NULL DEFAULT 0,
    comments_count  INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_group ON posts(group_id);
CREATE INDEX idx_posts_status ON posts(status);

-- ------------------------------------------------------------
-- 5. COMMENTAIRES
-- ------------------------------------------------------------
CREATE TABLE comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES comments(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    status          post_status NOT NULL DEFAULT 'publie',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);

-- ------------------------------------------------------------
-- 6. LIKES
-- ------------------------------------------------------------
CREATE TABLE likes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    likeable_type   likeable_type NOT NULL,
    likeable_id     UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, likeable_type, likeable_id)
);

CREATE INDEX idx_likes_likeable ON likes(likeable_type, likeable_id);

-- ------------------------------------------------------------
-- 7. FOLLOWS
-- ------------------------------------------------------------
CREATE TABLE follows (
    follower_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followed_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followed_id),
    CHECK (follower_id <> followed_id)
);

CREATE INDEX idx_follows_followed ON follows(followed_id);

-- ------------------------------------------------------------
-- 8. MESSAGERIE
-- ------------------------------------------------------------
CREATE TABLE conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_group        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversation_participants (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id),
    content         TEXT,
    media_url       TEXT,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);

-- ------------------------------------------------------------
-- 9. MODÉRATION / SIGNALEMENTS
-- ------------------------------------------------------------
CREATE TABLE reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id     UUID NOT NULL REFERENCES users(id),
    target_type     likeable_type NOT NULL,
    target_id       UUID NOT NULL,
    reason          report_reason NOT NULL,
    details         TEXT,
    status          report_status NOT NULL DEFAULT 'en_attente',
    handled_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at     TIMESTAMPTZ
);

CREATE INDEX idx_reports_status ON reports(status);

-- ------------------------------------------------------------
-- 10. NOTIFICATIONS
-- ------------------------------------------------------------
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            notification_type NOT NULL,
    actor_id        UUID REFERENCES users(id),
    reference_id    UUID,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- ------------------------------------------------------------
-- 11. TRANSACTIONS DE CREDITS (prépare la phase abonnement)
-- ------------------------------------------------------------
CREATE TABLE credit_transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount          INTEGER NOT NULL,
    reason          credit_reason NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_tx_user ON credit_transactions(user_id);

-- ============================================================
-- Fin de la migration 001
-- ============================================================
