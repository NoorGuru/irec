-- 016_add_advanced_analytics.sql
-- Add advanced tracking columns to user_portfolio from Google Sheets

ALTER TABLE user_portfolio
    ADD COLUMN IF NOT EXISTS current_price NUMERIC,
    ADD COLUMN IF NOT EXISTS total_return_pct NUMERIC,
    ADD COLUMN IF NOT EXISTS daily_change_pct NUMERIC,
    ADD COLUMN IF NOT EXISTS weekly_change_pct NUMERIC,
    ADD COLUMN IF NOT EXISTS monthly_change_pct NUMERIC,
    ADD COLUMN IF NOT EXISTS ytd_return_pct NUMERIC,
    ADD COLUMN IF NOT EXISTS sector TEXT,
    ADD COLUMN IF NOT EXISTS cap_size TEXT;
