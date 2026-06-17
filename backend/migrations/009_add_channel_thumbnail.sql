-- 009_add_channel_thumbnail.sql
-- Store the channel's YouTube profile thumbnail URL for display on the channels page.

ALTER TABLE channels ADD COLUMN channel_thumbnail_url TEXT;
