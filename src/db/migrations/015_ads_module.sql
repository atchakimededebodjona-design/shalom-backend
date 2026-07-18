-- =========================================================================
-- MODULE : PUBLICITÉS (Espace publicitaire du fil d'actualité)
-- =========================================================================

CREATE TABLE IF NOT EXISTS ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    link_url VARCHAR(500),

    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_ads_active ON ads(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_ads_deleted ON ads(deleted_at) WHERE deleted_at IS NULL;
