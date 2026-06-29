-- 013_add_stock_prices.sql
-- Stock prices table to store intraday and EOD ingested price data

CREATE TABLE IF NOT EXISTS stock_prices (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticker       TEXT NOT NULL,
    price        FLOAT NOT NULL,
    open_price   FLOAT,
    high         FLOAT,
    low          FLOAT,
    volume       BIGINT,
    source       TEXT NOT NULL DEFAULT 'yfinance' CHECK (source IN ('twelvedata', 'yfinance')),
    fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    market_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE(ticker, fetched_at)
);

CREATE INDEX idx_stock_prices_ticker_date ON stock_prices(ticker, market_date);
CREATE INDEX idx_stock_prices_ticker_fetched ON stock_prices(ticker, fetched_at DESC);

ALTER TABLE stock_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read stock_prices" ON stock_prices FOR SELECT USING (true);
