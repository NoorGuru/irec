-- 004_add_transcript.sql
-- Store the raw transcript text on videos for re-processing and auditing.

ALTER TABLE videos ADD COLUMN transcript TEXT;
