import { PipelineStep, ExtractionResult } from './types'

export const YOUTUBE_URL_REGEX =
  /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?.*v=|^(https?:\/\/)?youtu\.be\/|^(https?:\/\/)?(www\.)?youtube\.com\/shorts\//

export const TRANSCRIPT_WORKER_URL = process.env.NEXT_PUBLIC_TRANSCRIPT_WORKER_URL || 'https://yt-transcript-proxy.abukhleif94.workers.dev'

export function extractVideoId(urlStr: string): string | null {
  try {
    const trimmed = urlStr.trim()
    if (!trimmed) return null
    
    // Check standard watch?v=
    if (trimmed.includes('youtube.com/watch')) {
      const parts = trimmed.split('v=')
      if (parts[1]) {
        const id = parts[1].split('&')[0]
        if (id.length === 11) return id
      }
    }
    // Check youtu.be/
    if (trimmed.includes('youtu.be/')) {
      const parts = trimmed.split('youtu.be/')
      if (parts[1]) {
        const id = parts[1].split('?')[0].split('/')[0]
        if (id.length === 11) return id
      }
    }
    // Check shorts
    if (trimmed.includes('youtube.com/shorts/')) {
      const parts = trimmed.split('youtube.com/shorts/')
      if (parts[1]) {
        const id = parts[1].split('?')[0].split('/')[0]
        if (id.length === 11) return id
      }
    }
  } catch (e) {
    // ignore
  }
  return null
}

export const INITIAL_STEPS: PipelineStep[] = [
  { id: 'url_parse', label: 'Parse URL', status: 'pending' },
  { id: 'duplicate_check', label: 'Duplicate Check', status: 'pending' },
  { id: 'metadata', label: 'Fetch Metadata', status: 'pending' },
  { id: 'transcript', label: 'Fetch Transcript', status: 'pending' },
  { id: 'llm_parse', label: 'AI Extraction', status: 'pending' },
  { id: 'database', label: 'Save to Database', status: 'pending' },
]

export const DEMO_EVENTS: { step: string; status: string; detail: string; delay: number }[] = [
  { step: 'url_parse', status: 'running', detail: 'Parsing YouTube URL...', delay: 0 },
  { step: 'url_parse', status: 'done', detail: 'Video ID: dQw4w9WgXcQ', delay: 400 },
  { step: 'duplicate_check', status: 'running', detail: 'Checking for duplicates...', delay: 200 },
  { step: 'duplicate_check', status: 'done', detail: 'New video confirmed', delay: 600 },
  { step: 'metadata', status: 'running', detail: 'Fetching video metadata...', delay: 200 },
  { step: 'metadata', status: 'done', detail: 'Channel: Financial Analysis TV', delay: 900 },
  { step: 'transcript', status: 'running', detail: 'Fetching transcript via worker...', delay: 200 },
  { step: 'transcript', status: 'retrying', detail: 'Retry 1/3 — Proxy blocked, rotating...', delay: 1500 },
  { step: 'transcript', status: 'done', detail: '~4,230 words', delay: 1200 },
  { step: 'llm_parse', status: 'running', detail: 'Extracting recommendations via Claude...', delay: 300 },
  { step: 'llm_parse', status: 'done', detail: 'Found 3 ticker(s): AAPL, NVDA, MSFT', delay: 2500 },
  { step: 'database', status: 'running', detail: 'Persisting to Supabase...', delay: 200 },
  { step: 'database', status: 'done', detail: 'Saved successfully', delay: 500 },
]

export const DEMO_RESULT: ExtractionResult = {
  channel_name: 'Financial Analysis TV',
  channel_id: 'demo-channel-id',
  video_id: 'dQw4w9WgXcQ',
  title: 'Top 3 Stocks to Watch in 2025 — AAPL, NVDA & MSFT Deep Dive',
  published_at: '2025-06-10T14:30:00Z',
  tickers_extracted: ['AAPL', 'NVDA', 'MSFT'],
  recommendation_count: 3,
  video_summary: 'The analyst is strongly bullish on AI infrastructure plays, citing record data center capex as a secular tailwind. NVDA leads with a dominant GPU moat; AAPL is favored for its services flywheel and upcoming AI integration cycle; MSFT is a conviction buy for enterprise AI adoption through Azure and Copilot.',
}

export function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}m ${secs}s`
}
