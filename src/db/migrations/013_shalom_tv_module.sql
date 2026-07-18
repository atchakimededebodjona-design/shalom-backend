-- =========================================================================
-- MODULE : SHALOM TV
-- =========================================================================

-- Types de contenus : video, audio, text
DO $$ BEGIN
    CREATE TYPE shalom_tv_content_type AS ENUM ('video', 'audio', 'text');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Public ciblé : adult, child, all
DO $$ BEGIN
    CREATE TYPE shalom_tv_target_audience AS ENUM ('adult', 'child', 'all');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS shalom_tv_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type shalom_tv_content_type NOT NULL DEFAULT 'video',
    target_audience shalom_tv_target_audience NOT NULL DEFAULT 'all',
    
    media_url VARCHAR(500),         -- Lien direct vers le fichier stocké sur le serveur
    thumbnail_url VARCHAR(500),     -- Image de couverture (uploadée sur le serveur)
    content_text TEXT,              -- Contenu texte si c'est un article de blog
    
    duration_seconds INT DEFAULT 0, -- Durée estimée en secondes (pour info)
    
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Index pour la performance des recherches
CREATE INDEX IF NOT EXISTS idx_shalom_tv_contents_audience ON shalom_tv_contents(target_audience);
CREATE INDEX IF NOT EXISTS idx_shalom_tv_contents_type ON shalom_tv_contents(type);
CREATE INDEX IF NOT EXISTS idx_shalom_tv_contents_published ON shalom_tv_contents(is_published) WHERE is_published = TRUE;
CREATE INDEX IF NOT EXISTS idx_shalom_tv_contents_deleted ON shalom_tv_contents(deleted_at) WHERE deleted_at IS NULL;
