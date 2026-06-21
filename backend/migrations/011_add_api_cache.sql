-- 011_add_api_cache.sql
-- Create API cache table to support Today's Plays caching

CREATE TABLE IF NOT EXISTS api_cache (
    cache_key TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS (Row Level Security) if not already done, though public read/write can be configured if needed,
-- or just bypass RLS for backend service calls.
ALTER TABLE api_cache ENABLE ROW LEVEL SECURITY;

-- Allow read policy for public if we ever want to read from frontend (though usually it goes through backend service role)
CREATE POLICY "Public read api_cache" ON api_cache FOR SELECT USING (true);
