# YTPortfolio

AI-powered stock recommendation tracker. Extracts analyst sentiment from YouTube videos and displays consensus scores on a public dashboard.

## What it does

- Ingests YouTube video URLs via an admin interface
- Fetches transcripts and runs them through Claude to extract stock picks, sentiment, and conviction
- Aggregates recommendations into a weighted consensus score per ticker
- Serves a public, read-only dashboard with real-time data from Supabase

## Stack

| Layer | Tech |
|-------|------|
| Backend | Python · FastAPI · Claude (Anthropic) · Supabase |
| Frontend | Next.js 16 · TypeScript · Tailwind CSS · shadcn/ui |
| Infra | Supabase (Postgres + Auth) · Cloud Run · GitHub Pages |

## Quick start

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in keys
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # fill in keys
npm run dev
```

### Tests

```bash
cd backend && pytest
```

## How it works

```
YouTube URL → metadata + transcript → Claude extraction → Supabase → Dashboard
```

Each video produces structured recommendations (ticker, sentiment, conviction, target price) that feed into per-ticker consensus calculations weighted by channel trust.

## License

Private.
