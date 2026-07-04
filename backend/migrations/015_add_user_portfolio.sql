-- 015_add_user_portfolio.sql
-- Table for storing user stock portfolios, populated from Google Sheets or manually.

CREATE TABLE IF NOT EXISTS user_portfolio (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    ticker TEXT NOT NULL,
    shares NUMERIC,
    average_cost NUMERIC,
    currency TEXT DEFAULT 'USD',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_user_portfolio_user_id ON user_portfolio(user_id);
CREATE INDEX IF NOT EXISTS idx_user_portfolio_ticker ON user_portfolio(ticker);

ALTER TABLE user_portfolio ENABLE ROW LEVEL SECURITY;

-- Assuming standard Supabase auth
CREATE POLICY "Users can view their own portfolio" ON user_portfolio
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own portfolio" ON user_portfolio
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own portfolio" ON user_portfolio
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own portfolio" ON user_portfolio
    FOR DELETE USING (auth.uid() = user_id);
