-- 006_add_youtube_channel_id.sql
-- Store the YouTube channel ID on channels for direct linking.

ALTER TABLE channels ADD COLUMN youtube_channel_id TEXT;
CREATE UNIQUE INDEX idx_channels_youtube_channel_id ON channels(youtube_channel_id) WHERE youtube_channel_id IS NOT NULL;
