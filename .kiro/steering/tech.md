# Tech Stack & Build System

## Backend

- **Language**: Python 3.12+
- **Framework**: FastAPI (0.115)
- **Server**: Uvicorn
- **Database client**: supabase-py (2.13)
- **LLM**: Anthropic SDK (claude-sonnet-4-6)
- **Auth**: python-jose for JWT validation
- **Validation**: Pydantic v2
- **YouTube**: youtube-transcript-api, google-api-python-client
- **HTTP client**: httpx
- **Testing**: pytest + hypothesis (property-based testing)
- **Container**: Docker (python:3.13-slim), deployed to Cloud Run on port 8080

## Frontend

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **React**: 19
- **Styling**: Tailwind CSS 4 + tw-animate-css
- **Components**: shadcn/ui (via class-variance-authority, clsx, tailwind-merge)
- **Icons**: lucide-react
- **Auth/DB client**: @supabase/ssr + @supabase/supabase-js
- **Output**: Static export (next build → `out/`)

## Infrastructure

- **Database & Auth**: Supabase (PostgreSQL + Google OAuth + RLS)
- **Supabase project ref**: `deasjnsdrhnsxqssfbrn`
- **Supabase region**: ap-northeast-2
- **Backend hosting**: Google Cloud Run
- **Backend URL**: `https://irec-backend-f5xyrqhyjq-uc.a.run.app`
- **Transcript Worker**: Cloudflare Worker (`https://yt-transcript-proxy.abukhleif94.workers.dev`)
- **Frontend hosting**: Static (GitHub Pages via CNAME)
- **CI/CD**: GitHub Actions (deploy-backend.yml, deploy-frontend.yml, deploy-worker.yml)

## Common Commands

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000   # dev server
pytest                                       # run tests
pytest -k test_name                          # run specific test
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # dev server (localhost:3000)
npm run build        # production build (static export)
npm run lint         # ESLint
```

## OpenGraph Image Generation

Because the project uses Next.js static export (`output: "export"`) with `trailingSlash: true`, Next.js's automated `<meta>` tag injection for OpenGraph images is highly incompatible with Facebook's strict validators (which reject URLs ending in a slash). 

**The Solution Workflow:**
1. The OpenGraph design template is maintained as a React component in a hidden API route: `src/app/api/generate-og/route.tsx`.
2. Do **NOT** name this file `opengraph-image.tsx` in the root `app/` folder, otherwise Next.js will auto-inject broken trailing-slash meta tags.
3. When the design needs to be updated, run the dev server and execute:
   `curl -s http://localhost:3000/api/generate-og -o public/og.png`
4. The `app/layout.tsx` file is hardcoded to serve `https://aura.bynoor.io/og.png` directly, completely bypassing Next.js edge bugs and guaranteeing a flawless, pixel-perfect PNG fallback for all social platforms.

## Environment Variables

- Backend: configured via `backend/.env` (see `.env.example`)
- Frontend: configured via `frontend/.env.local` (see `.env.example`)
- Never commit `.env` or `.env.local` files
