-- 018_add_calibrated_scoring_columns.sql
-- Add calibrated scoring, confidence, and quote columns to recommendations

ALTER TABLE recommendations
    ADD COLUMN IF NOT EXISTS conviction_score NUMERIC(5, 1),
    ADD COLUMN IF NOT EXISTS conviction_confidence NUMERIC(3, 2),
    ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC(4, 2),
    ADD COLUMN IF NOT EXISTS sentiment_confidence NUMERIC(3, 2),
    ADD COLUMN IF NOT EXISTS quote TEXT;

CREATE INDEX IF NOT EXISTS idx_recommendations_conviction_score ON recommendations (conviction_score);
