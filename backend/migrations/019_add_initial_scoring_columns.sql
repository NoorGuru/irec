-- 019_add_initial_scoring_columns.sql
-- Add initial extraction baseline columns to preserve Claude's raw estimate alongside Jev's calibrated score

ALTER TABLE recommendations
    ADD COLUMN IF NOT EXISTS initial_conviction_level INTEGER,
    ADD COLUMN IF NOT EXISTS initial_sentiment INTEGER;
