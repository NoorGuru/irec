# YTPortfolio Setup Checklist

## 1. Supabase Project

- [ ] Create a Supabase project at https://supabase.com/dashboard
- [ ] Go to SQL Editor and run the contents of `backend/migrations/001_initial_schema.sql`
- [ ] Note down your Project URL (Settings → API)
- [ ] Note down your `anon` public key (Settings → API → Project API keys)
- [ ] Note down your `service_role` secret key (Settings → API → Project API keys)
- [ ] Note down your JWT Secret (Settings → API → JWT Settings)

## 2. Google Cloud Console

- [ ] Go to https://console.cloud.google.com
- [ ] Create a new project (or use an existing one)
- [ ] Enable "YouTube Data API v3" (APIs & Services → Library → search "YouTube Data API v3" → Enable)
- [ ] Create an API Key (APIs & Services → Credentials → Create Credentials → API Key)
- [ ] Note down the YouTube API Key
- [ ] Create an OAuth 2.0 Client ID (APIs & Services → Credentials → Create Credentials → OAuth client ID)
  - Application type: Web application
  - Authorized redirect URI: `https://<your-supabase-project>.supabase.co/auth/v1/callback`
- [ ] Note down the OAuth Client ID and Client Secret

## 3. Supabase Google Auth Provider

- [ ] Go to Supabase Dashboard → Authentication → Providers → Google
- [ ] Enable Google provider
- [ ] Paste your Google OAuth Client ID
- [ ] Paste your Google OAuth Client Secret
- [ ] Save

## 4. Anthropic API

- [ ] Go to https://console.anthropic.com
- [ ] Create an API key (or use an existing one)
- [ ] Note down the Anthropic API Key

## 5. Backend Environment Variables

- [ ] Create `backend/.env` with the following:

```env
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_SERVICE_KEY=<your-service-role-key>
SUPABASE_JWT_SECRET=<your-jwt-secret>
ANTHROPIC_API_KEY=<your-anthropic-api-key>
YOUTUBE_API_KEY=<your-youtube-api-key>
OWNER_EMAIL=<your-google-email@gmail.com>
CORS_ORIGINS=http://localhost:3000
```

## 6. Frontend Environment Variables

- [ ] Create `frontend/.env.local` with the following:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-public-key>
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_OWNER_EMAIL=<your-google-email@gmail.com>
```

## 7. Install Dependencies

- [ ] Backend: `cd backend && pip install -r requirements.txt`
- [ ] Frontend: `cd frontend && npm install`

## 8. Run the Project

- [ ] Start backend: `cd backend && uvicorn app.main:app --reload`
- [ ] Start frontend: `cd frontend && npm run dev`
- [ ] Open http://localhost:3000 — public dashboard should load (empty state)
- [ ] Go to http://localhost:3000/admin/ingest — should redirect to login
- [ ] Sign in with your Google account (must match OWNER_EMAIL)
- [ ] Submit a YouTube URL to test the pipeline

## 9. Verify Everything Works

- [ ] Public dashboard loads at `/`
- [ ] Admin login redirects non-owners with 403 message
- [ ] Ingestion Hub submits URLs and shows extracted tickers
- [ ] Ticker detail view shows recommendation timeline
- [ ] Backend tests pass: `cd backend && pytest tests/ -v`
- [ ] Frontend builds: `cd frontend && npm run build`
