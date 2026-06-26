-- 1. Create Radars Table
CREATE TABLE radars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    theme_color VARCHAR(50) DEFAULT '#00D4AA',
    icon VARCHAR(50) DEFAULT 'activity',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Radar Tickers Junction Table
CREATE TABLE radar_tickers (
    radar_id UUID REFERENCES radars(id) ON DELETE CASCADE,
    ticker VARCHAR(10) NOT NULL,
    PRIMARY KEY (radar_id, ticker)
);

-- 3. Create Radar History Table (for historical snapshotting)
CREATE TABLE radar_history (
    radar_id UUID REFERENCES radars(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    aura_score INT NOT NULL,
    omni_score INT NOT NULL,
    sentiment_pulse FLOAT NOT NULL,
    volume INT NOT NULL,
    PRIMARY KEY (radar_id, date)
);

-- 4. Set up Row Level Security (RLS)
-- Allow read access to anyone (since radar data is public)
ALTER TABLE radars ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar_tickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on radars" ON radars FOR SELECT USING (true);
CREATE POLICY "Allow public read access on radar_tickers" ON radar_tickers FOR SELECT USING (true);
CREATE POLICY "Allow public read access on radar_history" ON radar_history FOR SELECT USING (true);
