-- 008_add_video_duration.sql
-- Store the video duration (ISO 8601 format, e.g. "PT15M33S") from YouTube API.

ALTER TABLE videos ADD COLUMN duration TEXT;
