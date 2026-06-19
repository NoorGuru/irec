# Admin Control Panel — Implementation Plan

## Problem Statement

The admin currently manages core business logic (trust weights, fixing bad recs, deleting garbage videos, debugging LLM failures) via direct SQL and the Supabase Table Editor. This is error-prone, slow, and gives zero visibility into system health. We need a single, beautiful, mobile-first admin interface at `/admin/manage` to control everything.

## Requirements

- Single-page tab interface at `/admin/manage` with tabs: **Channels**, **Videos**, **Recommendations**, **LLM Logs**, **Stats**
- Mobile-first: tabs become a scrollable pill bar on small screens, content stacks into cards
- Channels tab: edit trust_weight (slider/stepper), rename, delete, merge duplicates
- Videos tab: browse all videos, filter by channel/date, delete, bulk re-extract
- Recommendations tab: search/filter all recs, inline edit (ticker, sentiment, target price, conviction), delete individual recs
- LLM Logs tab: view failures with raw response preview, retry extraction, purge old logs
- Stats tab: ingestion health (success rate, weekly volume, LLM failure rate)
- All mutations go through new backend API endpoints (secure, auditable)
- Reads use Supabase client directly (fast, RLS already allows SELECT)
- Matches existing design language: dark palette, big type, teal accents, Geist Mono for data

## Architecture

```
Frontend (/admin/manage — Tab-Based SPA)
├── Tab Bar: Channels | Videos | Recs | LLM | Stats
├── Channel Manager — Trust slider, rename, delete, merge
├── Video Browser — Filter, delete, bulk re-extract
├── Rec Editor — Inline edit, delete, search
├── LLM Debugger — View failures, raw response, retry
└── Health Stats — Weekly counts, success rate

Backend (New /api/v1/admin/* endpoints)
├── PATCH /admin/channels/:id
├── DELETE /admin/channels/:id
├── POST /admin/channels/merge
├── DELETE /admin/videos/:id
├── POST /admin/videos/bulk-reextract
├── PATCH /admin/recommendations/:id
├── DELETE /admin/recommendations/:id
├── POST /admin/llm-responses/:id/retry
├── DELETE /admin/llm-responses/purge
└── GET /admin/stats

Database (Supabase PostgreSQL)
├── channels
├── videos
├── recommendations
└── llm_responses
```

## UI Design Philosophy

- **Tab bar**: Horizontal pill-style tabs with a teal underline indicator that slides with a spring animation. On mobile: scrollable horizontally with fade edges.
- **Channels tab**: Each channel is a card with a large trust weight displayed as a horizontal "power bar" (0→2 range, teal fill). Inline slider to adjust. Delete gets a confirmation modal with cascading item count.
- **Videos tab**: Dense table on desktop, stacked cards on mobile. Each row shows title, channel badge, rec count, date. Swipe-to-delete on mobile, checkbox for bulk actions.
- **Recs tab**: The hero tab. Each rec rendered as a mini-card with the ticker in massive mono type, sentiment pulse bar, and editable fields. Click to expand inline editor.
- **LLM Logs tab**: Timeline-style list. Failures highlighted with red left-border. Expand to see raw JSON in a mono scrollable box. "Retry" button triggers re-extraction.
- **Stats tab**: 4 big stat cards (total videos, total recs, success rate %, this week's ingestions) + simple CSS-only bar chart for weekly trend.

## Task Breakdown

### Task 1: Add shadcn/ui primitives ✅
Install all required shadcn/ui components: tabs, dialog, input, slider, badge, toast, dropdown-menu, table, tooltip, separator, sheet.

### Task 2: Backend admin API — Channel mutations ✅
- `PATCH /admin/channels/{channel_id}` — update trust_weight, channel_name
- `DELETE /admin/channels/{channel_id}` — cascade delete with counts
- `POST /admin/channels/merge` — re-assign videos, delete source

### Task 3: Backend admin API — Video & Recommendation mutations ✅
- `DELETE /admin/videos/{video_id}` — cascade delete
- `POST /admin/videos/bulk-reextract` — re-run LLM for multiple videos
- `PATCH /admin/recommendations/{rec_id}` — partial update
- `DELETE /admin/recommendations/{rec_id}`

### Task 4: Backend admin API — LLM Logs & Stats ✅
- `POST /admin/llm-responses/{id}/retry` — retry extraction
- `DELETE /admin/llm-responses/purge` — bulk delete with filters
- `GET /admin/stats` — aggregated system health metrics

### Task 5: Frontend — /admin/manage page shell with tab navigation ✅
- Tab bar with pill-style tabs, teal sliding indicator
- URL-synced tab state via searchParams
- Auth guard, skeleton loading states

### Task 6: Frontend — Channels tab ✅
- Channel cards with trust weight "power bar"
- Inline slider (0.0–2.0), rename, delete with confirmation, merge flow

### Task 7: Frontend — Videos tab ✅
- Dense table (desktop) / stacked cards (mobile)
- Filters: channel, date, search. Bulk re-extract.

### Task 8: Frontend — Recommendations tab (hero tab) ✅
- Massive ticker type, sentiment pulse bars
- Inline editing: ticker, sentiment buttons, target price, conviction dots
- Search/filter, grouped view option

### Task 9: Frontend — LLM Logs tab ✅
- Timeline-style failure viewer with red left-border
- Raw response in mono scrollable box
- Retry button, purge controls

### Task 10: Frontend — Stats tab ✅
- 4 stat cards (big mono numbers)
- CSS-only weekly bar chart
- Channel leaderboard, recent failures

### Task 11: Integration — Wire into admin hub ✅
- "Control Panel" card on admin hub
- Cross-linking, breadcrumbs, keyboard shortcuts (1-5 for tabs)

## Design Tokens

- Background: `#0A0F1A`
- Surface: `#141B2D`
- Border: `#1E293B`
- Teal/Bullish: `#00D4AA`
- Red/Bearish: `#FF4D6A`
- Muted: `#8B95A8`
- Primary text: `#F1F5F9`
- Fonts: Geist Mono (data), Geist Sans (prose)

## Database Schema (current)

```sql
-- channels: channel_id (UUID PK), channel_name (UNIQUE), trust_weight (FLOAT, default 1.0), youtube_channel_id, channel_thumbnail_url, created_at
-- videos: video_id (UUID PK), channel_id (FK→channels), video_url (UNIQUE), youtube_video_id (UNIQUE), published_at, extracted_at, transcript, video_summary, title, duration
-- recommendations: id (UUID PK), video_id (FK→videos ON DELETE CASCADE), ticker, stock_name, sentiment (-2 to 2), target_price, conviction_level (1-10), catalyst_notes
-- llm_responses: id (UUID PK), youtube_video_id, raw_response, parse_success, error_detail, created_at
```

## Auth Pattern

Backend uses `verify_owner` dependency (JWT + email check). Frontend uses Supabase OAuth session. All new admin endpoints use `Depends(verify_owner)`.
