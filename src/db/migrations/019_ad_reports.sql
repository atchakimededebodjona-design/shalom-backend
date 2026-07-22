-- =========================================================================
-- MODULE : SIGNALEMENTS DE PUBLICITÉS
-- =========================================================================

CREATE TABLE IF NOT EXISTS ad_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id UUID NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(300),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (ad_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_ad_reports_ad ON ad_reports(ad_id);
