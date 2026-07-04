-- 017_add_1y_return.sql
-- Add 1y return pct to user_portfolio

ALTER TABLE user_portfolio
    ADD COLUMN IF NOT EXISTS "1y_return_pct" NUMERIC;
