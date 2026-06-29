-- 012_add_stock_meta.sql
-- Stock metadata table for managing Tier 1 and Tier 2 ingestion priorities

CREATE TABLE IF NOT EXISTS stock_meta (
    ticker            TEXT PRIMARY KEY,
    tier              SMALLINT NOT NULL DEFAULT 2 CHECK (tier IN (1, 2)),
    is_pinned         BOOLEAN NOT NULL DEFAULT FALSE,
    priority_score    FLOAT NOT NULL DEFAULT 0.0,
    mention_count_30d INT NOT NULL DEFAULT 0,
    analyst_count     INT NOT NULL DEFAULT 0,
    last_mentioned_at TIMESTAMPTZ,
    last_price_update TIMESTAMPTZ,
    last_updated_by   TEXT DEFAULT 'system',
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stock_meta_tier ON stock_meta(tier);
CREATE INDEX idx_stock_meta_priority ON stock_meta(priority_score DESC);

ALTER TABLE stock_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read stock_meta" ON stock_meta FOR SELECT USING (true);
