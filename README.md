# YTPortfolio

A monorepo application that extracts stock recommendations from YouTube video transcripts using AI, storing them in a structured database with a public dashboard for viewing aggregated data.

## Architecture

- **Backend**: Python 3.12+ / FastAPI — handles the extraction pipeline (URL parsing, metadata fetch, transcript fetch, LLM parsing, database persistence)
- **Frontend**: Next.js 14+ (App Router) with Tailwind CSS and shadcn/ui — admin ingestion interface and public dashboard
- **Database & Auth**: Supabase (PostgreSQL + Google OAuth)

## Prerequisites

- Python 3.12+
- Node.js 18+
- A Supabase project (for database and auth)
- YouTube Data API v3 key
- Anthropic API key

## Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Fill in your environment variables in .env
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Fill in your environment variables in .env.local
npm run dev
```

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key (bypasses RLS) |
| `SUPABASE_JWT_SECRET` | JWT secret for token validation |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key |
| `OWNER_EMAIL` | Email of the authorized admin user |
| `CORS_ORIGINS` | Comma-separated allowed origins |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (read-only) |
| `NEXT_PUBLIC_BACKEND_URL` | Backend API URL |
| `NEXT_PUBLIC_OWNER_EMAIL` | Owner email for display purposes |

## Running Tests

### Backend

```bash
cd backend
pytest
```

## Project Structure

```
├── backend/
│   ├── app/
│   │   └── __init__.py
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   └── .env.example
└── README.md
```
