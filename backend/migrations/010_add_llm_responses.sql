-- Store raw LLM responses for debugging parse failures.
-- On success, the response is kept for audit but can be purged periodically.
CREATE TABLE IF NOT EXISTS llm_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    youtube_video_id TEXT NOT NULL,
    raw_response TEXT NOT NULL,
    parse_success BOOLEAN NOT NULL DEFAULT FALSE,
    error_detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookup by video
CREATE INDEX IF NOT EXISTS idx_llm_responses_video_id ON llm_responses (youtube_video_id);

-- Index to find failures quickly
CREATE INDEX IF NOT EXISTS idx_llm_responses_failures ON llm_responses (parse_success) WHERE parse_success = FALSE;

-- RLS: public read-only (admin writes via service key)
ALTER TABLE llm_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON llm_responses
    FOR SELECT USING (true);
