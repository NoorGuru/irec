# Implementation Plan: YTPortfolio

## Overview

This plan implements the YTPortfolio system as a monorepo with a Python/FastAPI backend (extraction pipeline) and a Next.js frontend (admin zone + public dashboard). Tasks are ordered to build foundational infrastructure first, then backend services, then frontend components, with integration and wiring at the end.

## Tasks

- [ ] 1. Set up monorepo structure and configuration
  - [ ] 1.1 Create monorepo directory structure with backend and frontend directories
    - Create `backend/` and `frontend/` directories at the root
    - Add `backend/requirements.txt` with pinned dependencies: fastapi, uvicorn, supabase, anthropic, youtube-transcript-api, google-api-python-client, pydantic, python-jose, httpx
    - Add `backend/.env.example` with keys: SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_JWT_SECRET, ANTHROPIC_API_KEY, YOUTUBE_API_KEY, OWNER_EMAIL, CORS_ORIGINS
    - Add `frontend/.env.example` with keys: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_BACKEND_URL, NEXT_PUBLIC_OWNER_EMAIL
    - Create root-level `README.md` with setup instructions for both services
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ] 1.2 Initialize Next.js frontend with App Router, Tailwind CSS, and shadcn/ui
    - Run Next.js initialization with TypeScript and App Router
    - Configure Tailwind CSS
    - Install and configure shadcn/ui
    - Install @supabase/supabase-js and @supabase/ssr
    - Set up `frontend/package.json` with all required dependencies
    - _Requirements: 10.3_

  - [ ] 1.3 Create database migration SQL file
    - Create `backend/migrations/001_initial_schema.sql` with the full DDL
    - Include channels, videos, and recommendations tables with all constraints
    - Include indexes on recommendations.ticker and videos.youtube_video_id
    - Enable RLS on all tables with SELECT-only policies (no write policies)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [ ] 2. Implement backend core: schemas and URL parser
  - [ ] 2.1 Create Pydantic schemas module (`backend/app/schemas.py`)
    - Define ExtractionRequest, Recommendation, LLMResponse, ExtractionResponse, ParsedURL, VideoMetadata models
    - Implement `normalize_ticker` field_validator on Recommendation (uppercase, strip whitespace, replace periods with hyphens)
    - Add Field constraints: sentiment [-2, 2], conviction_level [1, 10], catalyst_notes [1, 500] chars, ticker [1, 5] chars
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 2.2 Write property test for ticker normalization idempotence
    - **Property 2: Ticker Normalization Idempotence**
    - Use Hypothesis to generate random ticker-like strings and verify f(f(x)) == f(x)
    - Verify strings differing only in case/whitespace/separators normalize identically
    - **Validates: Requirements 2.6**

  - [ ]* 2.3 Write property test for recommendation schema validation
    - **Property 3: Recommendation Schema Validation**
    - Use Hypothesis to generate random integers and verify acceptance boundaries for sentiment [-2, 2] and conviction [1, 10]
    - Generate random strings and verify catalyst_notes length constraints [1, 500]
    - **Validates: Requirements 2.3, 2.4, 2.5**

  - [ ] 2.4 Implement URL parser (`backend/app/url_parser.py`)
    - Support youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, youtube.com/embed/ formats
    - Extract 11-character Video_ID via regex
    - Strip extra query parameters (&t=, &list=, etc.)
    - Return ParsedURL with video_id and canonical URL
    - Raise appropriate error for invalid URLs (HTTP 400)
    - _Requirements: 1.1, 1.2_

  - [ ]* 2.5 Write property test for URL parsing roundtrip
    - **Property 1: URL Parsing Roundtrip**
    - Use Hypothesis to generate random 11-char alphanumeric video IDs, embed in random supported URL formats
    - Verify parsing extracts the correct video_id and re-parsing the canonical URL yields the same ID
    - **Validates: Requirements 1.1**

- [ ] 3. Implement backend services: metadata, transcript, and LLM parser
  - [ ] 3.1 Implement metadata fetcher (`backend/app/metadata.py`)
    - Call YouTube Data API v3 `videos.list` with `snippet` part
    - Extract channelTitle and publishedAt
    - Handle 404 (video not found on YouTube) with appropriate error
    - Set connect timeout 10s, read timeout 10s
    - _Requirements: 1.5, 1.6, 11.5_

  - [ ] 3.2 Implement transcript fetcher (`backend/app/transcript.py`)
    - Use YouTubeTranscriptApi.get_transcript(video_id) for English transcripts
    - Concatenate all segment text fields with single space separator
    - Handle TranscriptsDisabled and NoTranscriptFound exceptions → HTTP 422
    - _Requirements: 1.7, 1.8_

  - [ ] 3.3 Implement LLM parser (`backend/app/llm_parser.py`)
    - Use anthropic Python SDK with claude-sonnet model
    - Send system prompt with JSON schema definition for recommendations
    - Include channel name and publish date in user message context
    - Validate response against Pydantic LLMResponse model
    - Implement single retry on schema validation failure → HTTP 502 on second failure
    - Implement exponential backoff (1s, 2s, 4s) for rate limit (429), max 3 retries
    - Set connect timeout 10s, read timeout 30s
    - Return empty list with HTTP 200 when no recommendations found
    - _Requirements: 2.1, 2.2, 2.8, 2.9, 11.1, 11.2, 11.3_

  - [ ]* 3.4 Write property test for exponential backoff timing
    - **Property 8: Exponential Backoff Timing**
    - Use Hypothesis to generate sequences of retry counts and verify delays follow 1s, 2s, 4s pattern
    - Verify maximum of 3 retries before returning 429
    - **Validates: Requirements 11.1**

- [ ] 4. Implement backend database service
  - [ ] 4.1 Implement database service (`backend/app/database.py`)
    - Use supabase-py with SUPABASE_SERVICE_KEY (bypasses RLS)
    - Implement channel upsert with `ON CONFLICT (channel_name) DO UPDATE SET channel_name = EXCLUDED.channel_name RETURNING channel_id`
    - Implement video insert with youtube_video_id, video_url, channel_id FK, published_at
    - Implement batch recommendation insert linked to video_id
    - Implement duplicate check: query videos by youtube_video_id → HTTP 409
    - Handle empty recommendations: still insert channel and video records
    - Implement transaction rollback on failure for video + recommendations → HTTP 500
    - Set connect timeout 5s, read timeout 10s
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 11.4_

  - [ ]* 4.2 Write property test for channel upsert always returns UUID
    - **Property 4: Channel Upsert Always Returns UUID**
    - Use Hypothesis to generate random channel names
    - Mock database responses and verify upsert always returns a valid UUID, never empty
    - **Validates: Requirements 3.1**

- [ ] 5. Implement backend auth middleware and extraction endpoint
  - [ ] 5.1 Implement auth middleware (`backend/app/auth.py`)
    - Extract Authorization: Bearer <token> header
    - Validate JWT using python-jose with SUPABASE_JWT_SECRET
    - Case-insensitive comparison of email claim against OWNER_EMAIL
    - Return 401 for missing/invalid tokens
    - Return 403 for valid token but non-matching email
    - _Requirements: 4.1, 4.4, 4.5, 5.6, 5.7_

  - [ ] 5.2 Implement extraction endpoint and FastAPI app (`backend/app/main.py`)
    - Create FastAPI app with CORS configuration
    - Define POST /api/v1/extract endpoint with auth dependency
    - Orchestrate pipeline: URL parse → duplicate check → metadata → transcript → LLM → database
    - Return 201 with channel_name, video_id, tickers_extracted, recommendation_count on success
    - Return 422 for missing/invalid request body
    - Implement structured error logging (youtube_url, pipeline_stage, timestamp, error_details)
    - Ensure no timeout shorter than 120 seconds for request processing
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 11.6_

- [ ] 6. Checkpoint - Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement frontend authentication
  - [ ] 7.1 Implement Next.js middleware for admin route protection (`frontend/src/middleware.ts`)
    - Use @supabase/ssr for server-side session validation
    - Protect all /admin/* routes
    - Redirect unauthenticated users to /admin/login
    - _Requirements: 4.2, 4.3, 4.8_

  - [ ] 7.2 Implement admin login page and OAuth callback (`frontend/src/app/admin/login/page.tsx` and `frontend/src/app/auth/callback/route.ts`)
    - Create login page with Google OAuth button using Supabase Auth
    - Implement OAuth callback route for code exchange
    - Verify authenticated email matches NEXT_PUBLIC_OWNER_EMAIL (case-insensitive)
    - Show 403 message for non-owner authenticated users
    - Handle OAuth failure/cancellation with redirect and error message
    - _Requirements: 4.1, 4.4, 4.5, 4.9_

- [ ] 8. Implement frontend admin zone
  - [ ] 8.1 Implement Ingestion Hub page (`frontend/src/app/admin/ingest/page.tsx`)
    - Create text input field (max 2048 chars) for YouTube URL with submit button
    - Implement client-side URL pattern validation (youtube.com/watch?v=, youtu.be/, youtube.com/shorts/)
    - Show inline validation message for invalid format or empty input
    - Send POST request to backend /api/v1/extract with Bearer token
    - Show loading indicator during processing, disable submit button
    - On success: clear input, show confirmation toast with extracted tickers (auto-dismiss 5s)
    - On error: show error toast with backend error message (auto-dismiss 5s)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [ ] 9. Implement frontend public dashboard
  - [ ] 9.1 Implement Aggregation Dashboard (`frontend/src/app/page.tsx`)
    - Query Supabase directly using anon key with RLS (read-only)
    - Execute aggregation query: weighted consensus sentiment, avg target price (exclude nulls), mention count
    - Display data table with one row per ticker, sorted by mention count descending
    - Show "N/A" for avg target price when all values are null
    - Round consensus_sentiment to 2 decimal places
    - Make ticker rows clickable, navigating to /ticker/[symbol]
    - Show empty state message when no recommendations exist
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [ ] 9.2 Implement Ticker Detail View (`frontend/src/app/ticker/[symbol]/page.tsx`)
    - Query Supabase with case-insensitive ticker match (ILIKE)
    - Display recommendation timeline ordered by video publish date descending
    - Show channel name, publish date, sentiment, conviction, target price (or "N/A"), catalyst notes for each
    - Display ticker symbol in uppercase in page heading regardless of URL case
    - Show no-data message for unrecognized tickers
    - Validate ticker: reject if >5 chars or contains non-letter characters
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [ ] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The backend uses Python/FastAPI with Hypothesis for property-based testing
- The frontend uses TypeScript/Next.js with shadcn/ui components
- Channel upsert uses ON CONFLICT DO UPDATE (not DO NOTHING) to guarantee RETURNING always yields channel_id
- RLS only has SELECT policies — no write policies needed since service key bypasses RLS
- Ticker normalization via Pydantic field_validator ensures consistent representation across all data

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4"] },
    { "id": 3, "tasks": ["2.5", "3.1", "3.2"] },
    { "id": 4, "tasks": ["3.3", "4.1"] },
    { "id": 5, "tasks": ["3.4", "4.2", "5.1"] },
    { "id": 6, "tasks": ["5.2"] },
    { "id": 7, "tasks": ["7.1", "7.2"] },
    { "id": 8, "tasks": ["8.1", "9.1", "9.2"] }
  ]
}
```
