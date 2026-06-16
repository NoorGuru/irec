# Project Structure

```
/
├── backend/                    # Python FastAPI service
│   ├── app/                    # Application package
│   │   ├── main.py             # FastAPI app, CORS, /api/v1/extract endpoint
│   │   ├── auth.py             # JWT validation + owner-only enforcement
│   │   ├── url_parser.py       # YouTube URL parsing → video_id + canonical URL
│   │   ├── metadata.py         # YouTube Data API metadata fetch
│   │   ├── transcript.py       # Transcript retrieval via youtube-transcript-api
│   │   ├── llm_parser.py       # Anthropic Claude call + response parsing
│   │   ├── database.py         # Supabase persistence (channels, videos, recommendations)
│   │   └── schemas.py          # Pydantic models (request/response, domain types)
│   ├── migrations/             # SQL migration files (run manually in Supabase)
│   ├── tests/                  # pytest + hypothesis test suite
│   ├── requirements.txt        # Pinned Python dependencies
│   ├── Dockerfile              # Cloud Run container definition
│   └── .env.example            # Template for environment variables
│
├── frontend/                   # Next.js 16 App Router
│   ├── src/
│   │   ├── app/                # Route segments (App Router)
│   │   │   ├── page.tsx        # Public dashboard (aggregated tickers table)
│   │   │   ├── ticker/         # Per-ticker detail page
│   │   │   ├── admin/
│   │   │   │   ├── login/      # Google OAuth login page
│   │   │   │   └── ingest/     # Admin YouTube URL submission form
│   │   │   └── auth/callback/  # OAuth callback handler
│   │   ├── components/ui/      # shadcn/ui component primitives
│   │   └── lib/supabase/       # Supabase browser client factory
│   ├── public/                 # Static assets + CNAME
│   └── package.json            # Node dependencies and scripts
│
├── .github/workflows/          # CI/CD pipelines
│   ├── deploy-backend.yml      # Backend → Cloud Run
│   └── deploy-frontend.yml     # Frontend → static hosting
│
└── .kiro/
    ├── specs/                  # Feature specifications
    └── steering/               # AI assistant guidance (this directory)
```

## Conventions

- **API versioning**: All backend endpoints are prefixed with `/api/v1/`
- **Module boundaries**: Each pipeline stage is its own module in `backend/app/`
- **Error handling**: Pipeline stages raise `HTTPException` with appropriate status codes; `main.py` logs structured errors before re-raising
- **Database access**: Uses Supabase service key (bypasses RLS) for writes; frontend uses anon key (RLS enforced, read-only)
- **Frontend routing**: Next.js App Router with `'use client'` directives on interactive pages
- **Component library**: shadcn/ui components live in `src/components/ui/`; add new ones with the shadcn CLI
- **Styling**: Tailwind utility classes directly in JSX; dark mode supported via `dark:` variants
- **Tests**: Backend tests in `backend/tests/`; use `test_` prefix; property-based tests use hypothesis
