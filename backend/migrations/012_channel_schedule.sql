-- Add scheduling columns to existing channels table
ALTER TABLE channels 
  ADD COLUMN IF NOT EXISTS schedule_bucket TEXT NOT NULL DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_monitored BOOLEAN NOT NULL DEFAULT true;

-- Auto-balance: assign existing channels alternating A/B
WITH numbered AS (
  SELECT channel_id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM channels
)
UPDATE channels SET schedule_bucket = 
  CASE WHEN (SELECT rn FROM numbered WHERE numbered.channel_id = channels.channel_id) % 2 = 0 
  THEN 'B' ELSE 'A' END;

COMMENT ON COLUMN channels.schedule_bucket IS 'A = Mon+Thu, B = Tue+Fri';
COMMENT ON COLUMN channels.is_monitored IS 'If false, scheduler skips this channel';
