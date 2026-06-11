-- 001_initial_schema.sql
-- Initial database schema for YTPortfolio
-- Creates channels, videos, and recommendations tables with constraints,
-- indexes, and row-level security policies.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Channels table
CREATE TABLE channels (
    channel_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_name TEXT NOT NULL UNIQUE,
    trust_weight FLOAT NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Videos table
CREATE TABLE videos (
    video_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES channels(channel_id) ON DELETE CASCADE,
    video_url TEXT NOT NULL UNIQUE,
    youtube_video_id TEXT NOT NULL UNIQUE,
    published_at TIMESTAMPTZ NOT NULL,
    extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recommendations table
CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    sentiment INTEGER NOT NULL CHECK (sentiment BETWEEN -2 AND 2),
    target_price FLOAT,
    conviction_level INTEGER NOT NULL CHECK (conviction_level BETWEEN 1 AND 10),
    catalyst_notes TEXT NOT NULL DEFAULT ''
);

-- Indexes
CREATE INDEX idx_recommendations_ticker ON recommendations(ticker);
CREATE INDEX idx_videos_youtube_video_id ON videos(youtube_video_id);

-- Row Level Security
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

-- Public read policies (restricts anon key to SELECT only)
CREATE POLICY "Public read channels" ON channels FOR SELECT USING (true);
CREATE POLICY "Public read videos" ON videos FOR SELECT USING (true);
CREATE POLICY "Public read recommendations" ON recommendations FOR SELECT USING (true);
