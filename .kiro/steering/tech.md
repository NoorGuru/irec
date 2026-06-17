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
- **Frontend hosting**: Static (GitHub Pages via CNAME)
- **CI/CD**: GitHub Actions (deploy-backend.yml, deploy-frontend.yml)

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

## Environment Variables

- Backend: configured via `backend/.env` (see `.env.example`)
- Frontend: configured via `frontend/.env.local` (see `.env.example`)
- Never commit `.env` or `.env.local` files
