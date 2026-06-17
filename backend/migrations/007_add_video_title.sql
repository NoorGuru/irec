-- 007_add_video_title.sql
-- Store the YouTube video title for display on the frontend.

ALTER TABLE videos ADD COLUMN title TEXT;
