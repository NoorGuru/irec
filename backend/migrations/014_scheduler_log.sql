CREATE TABLE IF NOT EXISTS scheduler_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type TEXT NOT NULL CHECK (run_type IN ('channel_check', 'caption_fetch')),
    schedule_bucket TEXT,
    channels_checked INTEGER DEFAULT 0,
    new_videos_found INTEGER DEFAULT 0,
    captions_attempted INTEGER DEFAULT 0,
    captions_succeeded INTEGER DEFAULT 0,
    captions_failed INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER
);

ALTER TABLE scheduler_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read" ON scheduler_log;
CREATE POLICY "Public read" ON scheduler_log FOR SELECT USING (true);

DROP POLICY IF EXISTS "All roles full access" ON scheduler_log;
CREATE POLICY "All roles full access" ON scheduler_log FOR ALL USING (true);
