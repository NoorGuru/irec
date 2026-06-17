-- 005_add_video_summary.sql
-- Store the AI-generated video summary (overall thesis, catalysts, timeframe).

ALTER TABLE videos ADD COLUMN video_summary TEXT;
