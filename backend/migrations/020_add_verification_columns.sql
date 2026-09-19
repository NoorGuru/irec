-- 020_add_verification_columns.sql
-- Add verification metadata columns to store Jev extraction verification and target price confirmation

ALTER TABLE recommendations
    ADD COLUMN IF NOT EXISTS target_price_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_recommendations_target_price_verified 
    ON recommendations (target_price_verified) WHERE target_price IS NOT NULL;
