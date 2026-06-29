-- 014_add_ingestion_log.sql
-- Audit table for pipeline run tracking

CREATE TABLE IF NOT EXISTS ingestion_log (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_type      TEXT NOT NULL CHECK (run_type IN ('tier1_intraday', 'tier1_close', 'tier2_eod', 'tier_rerank')),
    started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at   TIMESTAMPTZ,
    status        TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed', 'market_closed')),
    stocks_total  INT DEFAULT 0,
    stocks_ok     INT DEFAULT 0,
    stocks_failed INT DEFAULT 0,
    fallback_used INT DEFAULT 0,
    credits_used  INT DEFAULT 0,
    error_detail  TEXT,
    metadata      JSONB
);

ALTER TABLE ingestion_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read ingestion_log" ON ingestion_log FOR SELECT USING (true);
