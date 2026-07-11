CREATE TABLE IF NOT EXISTS video_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    youtube_video_id TEXT NOT NULL UNIQUE,
    video_url TEXT NOT NULL,
    channel_id UUID REFERENCES channels(channel_id) ON DELETE SET NULL,
    channel_name TEXT,
    title TEXT,
    published_at TIMESTAMPTZ,
    thumbnail_url TEXT,
    duration TEXT,

    -- Queue status
    status TEXT NOT NULL DEFAULT 'discovered'
      CHECK (status IN (
        'discovered', 'pending_captions', 'fetching_captions',
        'ready_for_ai', 'processing_ai', 'completed',
        'caption_failed', 'ai_failed', 'dismissed', 'snoozed'
      )),

    -- Caption tracking
    caption_attempts INTEGER NOT NULL DEFAULT 0,
    max_caption_attempts INTEGER NOT NULL DEFAULT 5,
    last_caption_attempt_at TIMESTAMPTZ,
    caption_error TEXT,
    transcript TEXT,

    -- AI tracking (manual only)
    ai_triggered_at TIMESTAMPTZ,
    ai_completed_at TIMESTAMPTZ,
    ai_error TEXT,

    -- Timestamps
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dismissed_at TIMESTAMPTZ
);

-- Indexes for queue queries
CREATE INDEX IF NOT EXISTS idx_vq_status ON video_queue(status);
CREATE INDEX IF NOT EXISTS idx_vq_channel ON video_queue(channel_id);
CREATE INDEX IF NOT EXISTS idx_vq_discovered ON video_queue(discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_vq_published ON video_queue(published_at DESC);

-- RLS
ALTER TABLE video_queue ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists to avoid error on rerun, then create
DROP POLICY IF EXISTS "Public read" ON video_queue;
CREATE POLICY "Public read" ON video_queue FOR SELECT USING (true);

DROP POLICY IF EXISTS "All roles full access" ON video_queue;
CREATE POLICY "All roles full access" ON video_queue FOR ALL USING (true);
