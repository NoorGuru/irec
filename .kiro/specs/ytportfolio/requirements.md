# Requirements Document

## Introduction

YTPortfolio (iRec) is an automated pipeline and dashboard that extracts, standardizes, and aggregates stock recommendations from curated YouTube financial channels. The system is divided into two parts:

1. **Admin Zone** (authenticated): A protected interface where the owner can submit YouTube URLs for processing. Access is restricted via Google OAuth login to a single authorized user.
2. **Public Dashboard** (open): A read-only frontend that displays aggregated recommendation data to anyone without requiring authentication.

The system ingests YouTube video URLs, fetches transcripts, uses AI to parse structured stock recommendations, stores them in a relational database, and presents aggregated insights through the public dashboard.

## Glossary

- **Extraction_Pipeline**: The backend service responsible for fetching metadata, transcripts, invoking the LLM, and persisting structured data to the database.
- **Transcript_Fetcher**: The component that retrieves YouTube video transcripts using the youtube-transcript-api library.
- **Metadata_Fetcher**: The component that retrieves video metadata (channel name, publish date) from the YouTube Data API v3.
- **LLM_Parser**: The component that sends transcript text and video metadata to the Anthropic API and enforces a strict JSON schema for structured extraction of stock recommendations.
- **Database_Client**: The Supabase Python client responsible for all insert and query operations against PostgreSQL.
- **Admin_Zone**: The authenticated part of the application restricted to the owner via Google OAuth. Contains the Ingestion_Hub and any management features.
- **Public_Dashboard**: The open, read-only part of the application accessible to anyone without authentication. Contains the Aggregation_Dashboard and Ticker_Detail_View.
- **Auth_Guard**: The middleware component that validates Google OAuth tokens and restricts access to Admin_Zone routes.
- **Ingestion_Hub**: The admin-only view at `/admin/ingest` where the owner submits YouTube URLs for processing.
- **Aggregation_Dashboard**: The public view at `/` displaying grouped metrics per ticker.
- **Ticker_Detail_View**: The public dynamic route at `/ticker/[symbol]` showing a chronological timeline of mentions for a specific stock.
- **Recommendation**: A structured record containing a ticker symbol, sentiment score, optional target price, conviction level, and catalyst notes extracted from a video.
- **Sentiment**: An integer score from -2 (strong sell) to +2 (strong buy) representing the speaker's stance on a stock.
- **Conviction_Level**: An integer from 1 to 10 representing how strongly the speaker recommends the position.
- **Trust_Weight**: A per-channel multiplier (default 1.0) that can be adjusted to weight certain channels' recommendations higher or lower in aggregations.
- **Consensus_Sentiment**: The weighted average sentiment across all recommendations for a given ticker.
- **Video_ID**: The unique identifier extracted from a YouTube URL (the 11-character string).

## Requirements

### Requirement 1: YouTube Video Ingestion and Transcript Extraction

**User Story:** As the owner, I want to submit a YouTube URL and have the system automatically validate it, check for duplicates, fetch metadata, and retrieve the transcript, so that expensive downstream operations only run on new, valid videos.

#### Acceptance Criteria

1. WHEN a YouTube URL is submitted, THE Extraction_Pipeline SHALL parse and normalize the URL to extract the Video_ID (an 11-character string), supporting formats including `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, and URLs containing additional query parameters (e.g., `&t=`, `&list=`) which SHALL be stripped during normalization.
2. IF the YouTube URL format is invalid or a Video_ID cannot be extracted, THEN THE Extraction_Pipeline SHALL return an error response with HTTP status 400 and a message indicating the URL is malformed.
3. WHEN a Video_ID is extracted, THE Extraction_Pipeline SHALL query the database to check if a video with that Video_ID already exists.
4. IF the Video_ID already exists in the database, THEN THE Extraction_Pipeline SHALL return an error response with HTTP status 409 indicating the video has already been processed.
5. WHEN the Video_ID is confirmed as new, THE Metadata_Fetcher SHALL retrieve the channel name and video publish date from the YouTube Data API v3.
6. IF the YouTube Data API v3 returns no results for the given Video_ID, THEN THE Extraction_Pipeline SHALL return an error response with HTTP status 404 and a message indicating the video does not exist on YouTube.
7. WHEN metadata is retrieved, THE Transcript_Fetcher SHALL retrieve the English-language transcript and concatenate all segments into a single text block using a single space as the separator between segments.
8. IF the transcript is disabled or unavailable for the video, THEN THE Extraction_Pipeline SHALL return an error response with HTTP status 422 and a message indicating the transcript is not available.
9. WHEN a transcript is successfully fetched, THE Extraction_Pipeline SHALL pass the concatenated transcript text along with the channel name and publish date to the LLM_Parser.

### Requirement 2: AI-Powered Recommendation Parsing

**User Story:** As the owner, I want the system to use AI to extract structured stock recommendations from video transcripts, so that I get consistent and queryable data from unstructured video content.

#### Acceptance Criteria

1. WHEN transcript text and video metadata are received, THE LLM_Parser SHALL send both to the Anthropic API with a strict JSON schema enforcing the output structure.
2. WHEN transcript text and video metadata are received, THE LLM_Parser SHALL extract an array of Recommendation objects from the transcript, using the channel name and publish date provided by the Metadata_Fetcher (not inferred from transcript text).
3. WHEN a Recommendation is extracted, THE LLM_Parser SHALL assign a sentiment value as an integer between -2 and +2 inclusive.
4. WHEN a Recommendation is extracted, THE LLM_Parser SHALL assign a conviction_level as an integer between 1 and 10 inclusive.
5. WHEN a Recommendation is extracted, THE LLM_Parser SHALL include a catalyst_notes field containing a text summary of the speaker's reasoning, between 1 and 500 characters in length.
6. WHEN a Recommendation is extracted, THE LLM_Parser SHALL normalize the ticker field to an uppercase string between 1 and 5 characters representing the stock's exchange symbol. A Pydantic field validator in the backend SHALL post-process the LLM output by converting to uppercase, stripping all whitespace, and normalizing separator characters (replacing periods with hyphens) to ensure consistent ticker representation across all ingested data.
7. WHEN no target price is mentioned for a stock in the transcript, THE LLM_Parser SHALL return null for the target_price field.
8. IF the LLM response does not conform to the required JSON schema, THEN THE LLM_Parser SHALL retry the request once, and if it fails again, return an error response with HTTP status 502 and a message indicating the LLM output could not be parsed into the required schema.
9. IF the transcript contains no identifiable stock recommendations, THEN THE LLM_Parser SHALL return an empty recommendations array with HTTP status 200.

### Requirement 3: Database Persistence

**User Story:** As the owner, I want extracted recommendations to be stored in a structured database, so that I can query and aggregate them over time.

#### Acceptance Criteria

1. WHEN a channel name is provided by the Metadata_Fetcher, THE Database_Client SHALL upsert the channel into the channels table using `INSERT ... ON CONFLICT (channel_name) DO UPDATE SET channel_name = EXCLUDED.channel_name RETURNING channel_id`, ensuring the channel_id UUID is always returned for use as a foreign key in subsequent video inserts.
2. WHEN a video is processed, THE Database_Client SHALL insert a record into the videos table with the youtube_video_id, video URL, channel foreign key, and published_at timestamp from the Metadata_Fetcher.
3. WHEN recommendations are extracted, THE Database_Client SHALL insert each Recommendation into the recommendations table linked to the video record, storing the ticker, sentiment, target_price, conviction_level, and catalyst_notes fields.
4. THE Database_Client SHALL use UUIDs as primary keys for all table records.
5. IF a database insertion fails during the video or recommendations insert, THEN THE Database_Client SHALL roll back the video insert and all associated recommendation inserts for that request, and return an error response with HTTP status 500.
6. WHEN the LLM_Parser returns an empty recommendations array, THE Database_Client SHALL still insert the channel and video records so that the video is marked as processed.

### Requirement 4: Authentication and Access Control

**User Story:** As the owner, I want the ingestion interface to be restricted to my Google account only, so that no one else can submit videos or modify data.

#### Acceptance Criteria

1. THE Auth_Guard SHALL authenticate users via Google OAuth 2.0 using Supabase Auth.
2. THE Auth_Guard SHALL be implemented as a Next.js `middleware.ts` using `@supabase/ssr` to perform server-side session validation before any Admin_Zone route renders.
3. WHEN an unauthenticated user attempts to access any Admin_Zone route, THE Auth_Guard SHALL redirect the user to the `/admin/login` page.
4. WHEN a user authenticates successfully, THE Auth_Guard SHALL verify server-side that the authenticated email matches the configured owner email address using a case-insensitive comparison.
5. IF an authenticated user's email does not match the configured owner email, THEN THE Auth_Guard SHALL deny access with HTTP status 403 and display a message indicating the user is not authorized.
6. THE Auth_Guard SHALL protect all `/admin/*` frontend routes via Next.js middleware session validation, and all `/api/v1/extract` backend endpoints via FastAPI middleware JWT validation against the configured owner email.
7. THE Public_Dashboard SHALL be accessible without any authentication.
8. IF a user's session expires while accessing an Admin_Zone route, THEN THE Auth_Guard SHALL redirect the user to the `/admin/login` page.
9. IF the Google OAuth callback fails or the user cancels authentication, THEN THE Auth_Guard SHALL redirect the user to the `/admin/login` page and display a message indicating that authentication was not completed.

### Requirement 5: Extraction API Endpoint

**User Story:** As the owner, I want a single API endpoint that orchestrates the full extraction pipeline, so that I can trigger processing with one request.

#### Acceptance Criteria

1. THE Extraction_Pipeline SHALL expose a POST endpoint at `/api/v1/extract` that accepts a JSON payload with a `youtube_url` field.
2. IF the request body is missing or does not contain a valid JSON object with a `youtube_url` string field, THEN THE Extraction_Pipeline SHALL return HTTP status 422 with a validation error message.
3. WHEN a valid request is received, THE Extraction_Pipeline SHALL execute metadata fetching, transcript fetching, LLM parsing, and database insertion sequentially.
4. WHEN processing completes successfully, THE Extraction_Pipeline SHALL return HTTP status 201 with a response containing the channel name, video ID, an array of extracted ticker symbols, and the recommendation count.
5. WHILE the pipeline is processing a request, THE Extraction_Pipeline SHALL maintain the request context until completion or failure without a timeout shorter than 120 seconds.
6. IF the request does not include a valid authenticated session, THEN THE Extraction_Pipeline SHALL return HTTP status 401.
7. IF the request includes a valid session but the email does not match the configured owner email, THEN THE Extraction_Pipeline SHALL return HTTP status 403.

### Requirement 6: Ingestion Hub (Admin-Only)

**User Story:** As the owner, I want a clean input interface where I can paste YouTube URLs and see real-time feedback, so that I know when processing is happening and when it completes.

#### Acceptance Criteria

1. THE Ingestion_Hub SHALL be accessible only at the `/admin/ingest` route and require authenticated access.
2. THE Ingestion_Hub SHALL display a single text input field with a maximum length of 2048 characters for entering a YouTube URL and a submit button.
3. WHEN the owner activates the submit button, THE Ingestion_Hub SHALL validate that the input field is non-empty and matches a recognized YouTube URL pattern (`youtube.com/watch?v=`, `youtu.be/`, or `youtube.com/shorts/`) before sending the request to the backend, and SHALL display a loading indicator while the backend processes the request.
4. IF the input field is empty or does not match a recognized YouTube URL pattern, THEN THE Ingestion_Hub SHALL prevent submission and display an inline validation message indicating the expected URL format.
5. WHEN the backend returns a successful response, THE Ingestion_Hub SHALL clear the input field and display a confirmation toast notification listing the extracted ticker symbols that auto-dismisses after 5 seconds.
6. IF the backend returns an error response, THEN THE Ingestion_Hub SHALL display an error toast notification with the error message from the response that auto-dismisses after 5 seconds.
7. WHILE the backend is processing, THE Ingestion_Hub SHALL disable the submit button to prevent duplicate submissions.

### Requirement 7: Aggregation Dashboard (Public)

**User Story:** As a visitor, I want to see a consolidated view of all stock recommendations grouped by ticker, so that I can quickly assess which stocks have the strongest consensus signals.

#### Acceptance Criteria

1. THE Aggregation_Dashboard SHALL be accessible at `/` without authentication.
2. THE Aggregation_Dashboard SHALL display a data table with one row per unique ticker symbol, sorted by mention count in descending order by default.
3. THE Aggregation_Dashboard SHALL calculate and display the Consensus_Sentiment for each ticker as the average of all sentiment scores weighted by the channel Trust_Weight, rounded to two decimal places.
4. THE Aggregation_Dashboard SHALL calculate and display the average target price for each ticker, excluding null values from the calculation. IF all target_price values for a ticker are null, THEN THE Aggregation_Dashboard SHALL display "N/A" in the target price column for that ticker.
5. THE Aggregation_Dashboard SHALL display the total mention count (number of Recommendation records) for each ticker.
6. THE Aggregation_Dashboard SHALL query Supabase directly from the frontend to fetch aggregated data.
7. WHEN a visitor clicks on a ticker row, THE Aggregation_Dashboard SHALL navigate to the Ticker_Detail_View for that symbol.
8. IF no Recommendation records exist in the database, THEN THE Aggregation_Dashboard SHALL display a message indicating that no stock recommendations are available yet.

### Requirement 8: Ticker Detail View (Public)

**User Story:** As a visitor, I want to drill into a specific stock and see every mention chronologically with full context, so that I can evaluate the quality and recency of recommendations.

#### Acceptance Criteria

1. THE Ticker_Detail_View SHALL be accessible at `/ticker/[symbol]` without authentication.
2. WHEN a ticker symbol is provided in the URL path, THE Ticker_Detail_View SHALL perform a case-insensitive match against stored ticker values and display a timeline of all Recommendation records for that ticker, ordered by video publish date descending (most recent first).
3. THE Ticker_Detail_View SHALL display for each recommendation: the channel name, video publish date, sentiment score (integer from -2 to +2), conviction level (integer from 1 to 10), target price (or "N/A" if null), and catalyst notes.
4. THE Ticker_Detail_View SHALL order recommendations by video publish date in descending order (most recent first).
5. IF no recommendations exist for the given ticker symbol, THEN THE Ticker_Detail_View SHALL display a message indicating no data is available for that symbol.
6. THE Ticker_Detail_View SHALL display the ticker symbol in uppercase in the page heading, regardless of the case used in the URL path.
7. IF the ticker symbol in the URL path contains characters other than letters or exceeds 5 characters in length, THEN THE Ticker_Detail_View SHALL display the same no-data-available message as for unrecognized symbols.

### Requirement 9: Database Schema

**User Story:** As the owner, I want a well-structured relational database that supports the data model, so that queries are efficient and data integrity is maintained.

#### Acceptance Criteria

1. THE Database_Client SHALL create a `channels` table with columns: channel_id (UUID, primary key), channel_name (text, unique, not null), trust_weight (float, not null, default 1.0).
2. THE Database_Client SHALL create a `videos` table with columns: video_id (UUID, primary key), channel_id (UUID, not null, foreign key to channels), video_url (text, unique, not null), youtube_video_id (text, unique, not null), published_at (timestamptz, not null), extracted_at (timestamptz, not null, default now()).
3. THE Database_Client SHALL create a `recommendations` table with columns: id (UUID, primary key), video_id (UUID, not null, foreign key to videos), ticker (text, not null), sentiment (integer, not null, constrained between -2 and 2), target_price (float, nullable), conviction_level (integer, not null, constrained between 1 and 10), catalyst_notes (text, not null, default empty string).
4. THE Database_Client SHALL enforce referential integrity via foreign key constraints with ON DELETE CASCADE between recommendations and videos, and between videos and channels.
5. THE Database_Client SHALL add an index on recommendations.ticker and an index on videos.youtube_video_id to support aggregation queries and duplicate video lookups.
6. THE Database_Client SHALL use TIMESTAMP WITH TIME ZONE (timestamptz) for all timestamp columns to ensure correct handling across time zones.
7. THE Database_Client SHALL enable Row Level Security on all tables with policies that allow public read access (SELECT) to all rows. Write policies (INSERT, UPDATE, DELETE) SHALL NOT be defined for the service role, because the backend connects using the SUPABASE_SERVICE_KEY which bypasses RLS entirely. RLS is only needed to restrict the anon key used by the frontend to read-only access.

### Requirement 10: Monorepo Structure and Configuration

**User Story:** As a user, I want a properly scaffolded monorepo with all dependencies declared, so that I can run the project immediately without manual configuration.

#### Acceptance Criteria

1. THE System SHALL organize the codebase as a monorepo with separate `backend` and `frontend` directories at the root.
2. THE System SHALL provide a `backend/requirements.txt` file declaring all Python dependencies with pinned versions (using `==` syntax).
3. THE System SHALL provide a `frontend/package.json` file declaring all Node.js dependencies for Next.js, React, Tailwind CSS, shadcn/ui, @supabase/supabase-js, and @supabase/ssr.
4. THE System SHALL provide environment variable templates (`.env.example`) for both backend and frontend listing all required configuration keys without secret values, where the backend template includes at minimum: SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_JWT_SECRET, ANTHROPIC_API_KEY, YOUTUBE_API_KEY, OWNER_EMAIL, and CORS_ORIGINS; and the frontend template includes at minimum: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_BACKEND_URL, and NEXT_PUBLIC_OWNER_EMAIL.
5. THE System SHALL provide a root-level README.md file containing step-by-step instructions for installing dependencies and starting both the backend and frontend services locally.

### Requirement 11: Error Handling and Resilience

**User Story:** As the owner, I want the system to handle failures gracefully with clear error messages, so that I understand what went wrong and can take corrective action.

#### Acceptance Criteria

1. IF the Anthropic API returns a rate limit error (HTTP 429), THEN THE LLM_Parser SHALL wait and retry up to 3 times with exponential backoff starting at 1 second and doubling each subsequent attempt (1s, 2s, 4s).
2. IF the LLM_Parser exhausts all 3 retry attempts for a rate limit error, THEN THE Extraction_Pipeline SHALL return HTTP status 429 with a message indicating the AI service is rate limited and the request should be retried later.
3. IF the Anthropic API does not respond within 30 seconds or the connection cannot be established within 10 seconds, THEN THE Extraction_Pipeline SHALL return HTTP status 503 with a message indicating the AI service is temporarily unavailable.
4. IF the Supabase service does not respond within 10 seconds or the connection cannot be established within 5 seconds, THEN THE Extraction_Pipeline SHALL return HTTP status 503 with a message indicating the database service is temporarily unavailable.
5. IF the YouTube Data API does not respond within 10 seconds or returns an HTTP error status, THEN THE Extraction_Pipeline SHALL return HTTP status 502 with a message indicating video metadata could not be retrieved.
6. WHEN any error occurs during processing, THE Extraction_Pipeline SHALL log the error context including the YouTube URL, pipeline stage (url_parsing, duplicate_check, metadata_fetch, transcript_fetch, llm_parse, or database_insert), timestamp, and error details.
