'use client'

import { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, XCircle, Loader2, Circle, RefreshCw, LogOut, Clock, Zap, RotateCcw, Sparkles } from 'lucide-react'

const YOUTUBE_URL_REGEX =
  /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?.*v=|^(https?:\/\/)?youtu\.be\/|^(https?:\/\/)?(www\.)?youtube\.com\/shorts\//

const TRANSCRIPT_WORKER_URL = process.env.NEXT_PUBLIC_TRANSCRIPT_WORKER_URL || 'https://yt-transcript-proxy.abukhleif94.workers.dev'

function extractVideoId(urlStr: string): string | null {
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

type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'retrying'

interface PipelineStep {
  id: string
  label: string
  status: StepStatus
  detail?: string
  startedAt?: number
  completedAt?: number
}

interface ExtractionResult {
  channel_name: string
  channel_id?: string | null
  video_id: string
  title?: string | null
  published_at: string
  tickers_extracted: string[]
  recommendation_count: number
  video_summary?: string | null
}

const INITIAL_STEPS: PipelineStep[] = [
  { id: 'url_parse', label: 'Parse URL', status: 'pending' },
  { id: 'duplicate_check', label: 'Duplicate Check', status: 'pending' },
  { id: 'metadata', label: 'Fetch Metadata', status: 'pending' },
  { id: 'transcript', label: 'Fetch Transcript', status: 'pending' },
  { id: 'llm_parse', label: 'AI Extraction', status: 'pending' },
  { id: 'database', label: 'Save to Database', status: 'pending' },
]

// --- Demo mode ---
const DEMO_EVENTS: { step: string; status: string; detail: string; delay: number }[] = [
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

const DEMO_RESULT: ExtractionResult = {
  channel_name: 'Financial Analysis TV',
  channel_id: 'demo-channel-id',
  video_id: 'dQw4w9WgXcQ',
  title: 'Top 3 Stocks to Watch in 2025 — AAPL, NVDA & MSFT Deep Dive',
  published_at: '2025-06-10T14:30:00Z',
  tickers_extracted: ['AAPL', 'NVDA', 'MSFT'],
  recommendation_count: 3,
  video_summary: 'The analyst is strongly bullish on AI infrastructure plays, citing record data center capex as a secular tailwind. NVDA leads with a dominant GPU moat; AAPL is favored for its services flywheel and upcoming AI integration cycle; MSFT is a conviction buy for enterprise AI adoption through Azure and Copilot.',
}

/** Formats elapsed ms into a readable string */
function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}m ${secs}s`
}

/** Live elapsed timer component */
function ElapsedTimer({ startedAt, completedAt }: { startedAt: number; completedAt?: number }) {
  const spanRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (completedAt) {
      if (spanRef.current) {
        spanRef.current.textContent = formatElapsed(completedAt - startedAt)
      }
      return
    }
    // Initial render
    if (spanRef.current) {
      spanRef.current.textContent = formatElapsed(Date.now() - startedAt)
    }
    const interval = setInterval(() => {
      if (spanRef.current) {
        spanRef.current.textContent = formatElapsed(Date.now() - startedAt)
      }
    }, 100)
    return () => clearInterval(interval)
  }, [startedAt, completedAt])

  const initialElapsed = completedAt ? completedAt - startedAt : 0

  return (
    <span
      ref={spanRef}
      className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[#8B95A8]/60 tabular-nums"
    >
      {formatElapsed(initialElapsed)}
    </span>
  )
}

function IngestContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isDemo = searchParams.get('demo') === '1'
  const [url, setUrl] = useState('')
  const [validationError, setValidationError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [steps, setSteps] = useState<PipelineStep[]>([])
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [pipelineError, setPipelineError] = useState('')
  const [isDuplicate, setIsDuplicate] = useState(false)
  const [duplicateVideo, setDuplicateVideo] = useState<any | null>(null)
  const [lastSubmittedUrl, setLastSubmittedUrl] = useState('')
  const [authChecked, setAuthChecked] = useState(isDemo)
  const [totalStartedAt, setTotalStartedAt] = useState<number | null>(null)
  const [totalCompletedAt, setTotalCompletedAt] = useState<number | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [showManualPaste, setShowManualPaste] = useState(false)
  const [manualTranscript, setManualTranscript] = useState('')
  const [manualVideoId, setManualVideoId] = useState<string | null>(null)
  const [workerUrl, setWorkerUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleTranscriptChange = useCallback((text: string) => {
    let cleanText = text
    try {
      const trimmed = text.trim()
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed)
        if (parsed && typeof parsed === 'object') {
          if (typeof parsed.transcript === 'string') {
            cleanText = parsed.transcript
          } else if (typeof parsed.text === 'string') {
            cleanText = parsed.text
          }
        }
      }
    } catch (e) {
      // Keep original text
    }
    setManualTranscript(cleanText)
  }, [])

  useEffect(() => {
    if (isDemo) return
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/admin/login')
        return
      }
      const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || ''
      if (session.user.email?.toLowerCase() !== ownerEmail.toLowerCase()) {
        await supabase.auth.signOut()
        router.replace('/admin/login?error=not_owner')
        return
      }
      setUserEmail(session.user.email ?? null)
      const meta = session.user.user_metadata
      const firstName = (meta?.full_name || meta?.name || '').split(' ')[0]
      setDisplayName(firstName || session.user.email?.split('@')[0] || null)
      setAuthChecked(true)
    }
    checkAuth()
  }, [router])

  // Fetch duplicate video details when isDuplicate becomes true
  useEffect(() => {
    if (!isDuplicate) {
      setDuplicateVideo(null)
      return
    }

    // In demo mode, mock duplicateVideo data
    if (isDemo) {
      setDuplicateVideo({
        video_id: 'demo-id',
        youtube_video_id: extractVideoId(lastSubmittedUrl) || 'dQw4w9WgXcQ',
        title: 'Top 3 Stocks to Watch in 2025 — AAPL, NVDA & MSFT Deep Dive',
        published_at: '2025-06-10T14:30:00Z',
        video_summary: 'The analyst is strongly bullish on AI infrastructure plays, citing record data center capex as a secular tailwind. NVDA leads with a dominant GPU moat; AAPL is favored for its services flywheel and upcoming AI integration cycle; MSFT is a conviction buy for enterprise AI adoption through Azure and Copilot.',
        channels: {
          channel_name: 'Financial Analysis TV'
        }
      })
      return
    }

    const videoId = extractVideoId(lastSubmittedUrl)
    if (!videoId) return

    const fetchDuplicateDetails = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('videos')
          .select(`
            video_id,
            youtube_video_id,
            title,
            published_at,
            video_summary,
            channels!inner(channel_name)
          `)
          .eq('youtube_video_id', videoId)
          .single()

        if (!error && data) {
          setDuplicateVideo(data)
        }
      } catch (e) {
        console.error('Error fetching duplicate video:', e)
      }
    }

    fetchDuplicateDetails()
  }, [isDuplicate, lastSubmittedUrl, isDemo])

  // Auto-focus input when auth resolves
  useEffect(() => {
    if (authChecked && inputRef.current) {
      inputRef.current.focus()
    }
  }, [authChecked])

  const validateUrl = (value: string): boolean => {
    if (!value.trim()) {
      setValidationError('Enter a YouTube URL to extract.')
      return false
    }
    if (!YOUTUBE_URL_REGEX.test(value.trim())) {
      setValidationError(
        'Supported formats: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/'
      )
      return false
    }
    setValidationError('')
    return true
  }

  const updateStep = useCallback((stepId: string, status: StepStatus, detail?: string) => {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id !== stepId) return s
        const now = Date.now()
        return {
          ...s,
          status,
          detail,
          startedAt: s.startedAt || (status === 'running' ? now : undefined),
          completedAt: status === 'done' || status === 'error' ? now : s.completedAt,
        }
      })
    )
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!validateUrl(url)) return

    await startExtraction(url.trim(), 'normal')
  }

  const handleReextract = async () => {
    if (!lastSubmittedUrl) return
    await startExtraction(lastSubmittedUrl, 'reextract')
  }

  const handleForceReingest = async () => {
    if (!lastSubmittedUrl) return
    await startExtraction(lastSubmittedUrl, 'force_reingest')
  }

  const startExtraction = async (
    targetUrl: string,
    mode: 'normal' | 'reextract' | 'force_reingest',
    manualTranscriptText?: string
  ) => {
    setIsLoading(true)
    setValidationError('')
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: 'pending', detail: undefined, startedAt: undefined, completedAt: undefined })))
    setResult(null)
    setPipelineError('')
    setIsDuplicate(false)
    setDuplicateVideo(null)
    setLastSubmittedUrl(targetUrl)
    setTotalStartedAt(Date.now())
    setTotalCompletedAt(null)

    // --- Demo mode ---
    if (isDemo) {
      const isDuplicateDemo = searchParams.get('duplicate') === '1'
      for (const event of DEMO_EVENTS) {
        await new Promise((resolve) => setTimeout(resolve, event.delay))
        if (isDuplicateDemo && event.step === 'duplicate_check') {
          updateStep('duplicate_check', 'error', 'Video already processed')
          setIsDuplicate(true)
          setTotalCompletedAt(Date.now())
          setIsLoading(false)
          return
        }
        updateStep(event.step, event.status as StepStatus, event.detail)
      }
      await new Promise((resolve) => setTimeout(resolve, 300))
      setResult(DEMO_RESULT)
      setTotalCompletedAt(Date.now())
      setUrl('')
      setIsLoading(false)
      return
    }

    // --- Real mode ---
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setPipelineError('Session expired. Please log in again.')
        setIsLoading(false)
        return
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/extract/stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            youtube_url: targetUrl,
            ...(mode === 'force_reingest' && { force_reingest: true }),
            ...(mode === 'reextract' && { reextract_only: true }),
            ...(manualTranscriptText && { transcript: manualTranscriptText }),
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        setPipelineError(errorData?.detail || `Request failed (${response.status})`)
        setIsLoading(false)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        setPipelineError('Streaming not supported')
        setIsLoading(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6))
              if (event.step === 'complete' && event.status === 'done') {
                setResult(event.result)
                setTotalCompletedAt(Date.now())
              } else if (event.status === 'error') {
                updateStep(event.step, 'error', event.detail)
                setPipelineError(event.detail || 'An error occurred')
                // Detect duplicate specifically
                if (event.step === 'duplicate_check' && event.detail === 'Video already processed') {
                  setIsDuplicate(true)
                }
                // Detect manual fallback required
                if (event.needs_manual) {
                  setShowManualPaste(true)
                  if (event.video_id) setManualVideoId(event.video_id)
                  if (event.worker_url) setWorkerUrl(event.worker_url)
                }
                setTotalCompletedAt(Date.now())
              } else {
                updateStep(event.step, event.status, event.detail)
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }
      }

      setSteps((prev) => {
        const hasError = prev.some((s) => s.status === 'error')
        if (!hasError) {
          setUrl('')
          setManualTranscript('')
          setShowManualPaste(false)
        }
        return prev
      })
    } catch {
      setPipelineError('Network error. Check your connection and try again.')
      setTotalCompletedAt(Date.now())
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/admin/login')
  }

  const StepIcon = ({ status }: { status: StepStatus }) => {
    switch (status) {
      case 'done':
        return <CheckCircle2 className="h-4 w-4 text-[#00D4AA]" />
      case 'error':
        return <XCircle className="h-4 w-4 text-[#FF4D6A]" />
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-[#00D4AA]" />
      case 'retrying':
        return <RefreshCw className="h-4 w-4 animate-spin text-[#F59E0B]" />
      default:
        return <Circle className="h-4 w-4 text-[#8B95A8]/20" />
    }
  }

  // ─── Loading state ───
  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0F1A]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-5 w-5 animate-spin text-[#00D4AA]/60" />
          <p className="text-xs text-[#64748B] tracking-wide">Verifying session...</p>
        </div>
      </div>
    )
  }

  // ─── Completed steps count ───
  const completedCount = steps.filter(s => s.status === 'done').length
  const totalSteps = steps.length
  const progress = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0

  return (
    <div className="flex min-h-screen flex-col bg-[#0A0F1A]">
      {/* ─── Top navigation bar ─── */}
      <header className="sticky top-0 z-50 border-b border-[#1E293B]/60 bg-[#0A0F1A]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-extralight tracking-[0.2em] text-[#F1F5F9]/60 hover:text-[#F1F5F9] transition-colors">
              aura
            </Link>
            <span className="text-[#1E293B]">/</span>
            <Link href="/admin" className="font-[family-name:var(--font-geist-mono)] text-xs text-[#8B95A8] hover:text-[#F1F5F9] transition-colors tracking-wider">
              admin
            </Link>
            <span className="text-[#1E293B]">/</span>
            <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[#00D4AA]/70 tracking-wider">
              ingest
            </span>
          </div>

          <div className="flex items-center gap-3">
            {userEmail && (
              <span className="hidden sm:inline text-[11px] text-[#64748B] font-[family-name:var(--font-geist-mono)]">
                {displayName}
              </span>
            )}
            {isDemo && (
              <span className="text-[10px] font-[family-name:var(--font-geist-mono)] text-[#F59E0B]/70 border border-[#F59E0B]/20 rounded px-2 py-0.5 uppercase tracking-wider">
                Demo
              </span>
            )}
            {!isDemo && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-[#8B95A8] hover:text-[#F1F5F9] hover:bg-[#141B2D] transition-all"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ─── Main content ─── */}
      <main className="flex-1 px-5 py-12 md:py-20">
        <div className="mx-auto w-full max-w-4xl space-y-8">
          {/* ─── Page heading ─── */}
          <div className="animate-hero-rise">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-[#F1F5F9]">
              Ingest
            </h1>
            <p className="mt-3 text-base text-[#8B95A8]">
              Drop a YouTube URL and let Claude do the heavy lifting.
            </p>
          </div>

          {/* ─── Form ─── */}
          <form onSubmit={handleSubmit} className="space-y-4 animate-fade-up stagger-2">
            <div className="relative">
              <label htmlFor="youtube-url" className="sr-only">
                YouTube URL
              </label>
              <input
                ref={inputRef}
                id="youtube-url"
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  if (validationError) setValidationError('')
                }}
                maxLength={2048}
                placeholder="youtube.com/watch?v=..."
                className="w-full rounded-xl border border-[#1E293B] bg-[#141B2D] px-4 py-3.5 font-[family-name:var(--font-geist-mono)] text-sm text-[#F1F5F9] placeholder:text-[#8B95A8]/40 focus:border-[#00D4AA]/60 focus:outline-none focus:ring-1 focus:ring-[#00D4AA]/30 disabled:opacity-50 transition-all duration-200"
                disabled={isLoading}
                aria-describedby={validationError ? 'url-error' : undefined}
                aria-invalid={validationError ? true : undefined}
              />
              {/* Subtle glow when focused */}
              <div className="pointer-events-none absolute inset-0 rounded-xl border border-transparent opacity-0 peer-focus:opacity-100 transition-opacity" />
            </div>

            {validationError && (
              <p id="url-error" className="text-sm text-[#FF4D6A] animate-fade-up" role="alert">
                {validationError}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full rounded-xl bg-[#00D4AA] px-6 py-3.5 text-sm font-semibold text-[#0A0F1A] transition-all duration-200 hover:bg-[#00D4AA]/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4AA]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F1A]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Zap className="h-4 w-4" />
                  Extract
                </span>
              )}
            </button>
          </form>

          {/* Proactive manual paste link */}
          {!isLoading && (
            <div className="flex justify-end animate-fade-up">
              <button
                type="button"
                onClick={() => setShowManualPaste(!showManualPaste)}
                className="text-xs text-[#8B95A8]/70 hover:text-[#00D4AA] transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {showManualPaste ? 'Hide manual transcript paste' : 'Paste transcript manually'}
              </button>
            </div>
          )}

          {/* Manual paste panel */}
          {showManualPaste && (
            <div className="rounded-2xl border border-[#00D4AA]/20 bg-[#00D4AA]/[0.02] p-6 space-y-4 animate-fade-up">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#00D4AA]" />
                  <h3 className="text-sm font-semibold text-[#F1F5F9]">
                    Manual Transcript Fallback
                  </h3>
                </div>
                {/* Close button */}
                <button
                  type="button"
                  onClick={() => setShowManualPaste(false)}
                  className="text-xs text-[#8B95A8]/50 hover:text-[#F1F5F9] transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Optional Link/ID input to fetch direct link inside panel */}
              <div className="space-y-1.5 bg-[#0A0F1A]/40 border border-[#1E293B] rounded-xl p-4">
                <label className="text-[11px] font-semibold text-[#8B95A8] block">
                  YouTube URL or Video ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter URL or 11-char ID..."
                    value={url || ''}
                    onChange={(e) => {
                      const inputVal = e.target.value.trim()
                      // If it's 11 chars and has no youtube structures, treat as video ID
                      if (inputVal.length === 11 && !inputVal.includes('/') && !inputVal.includes('.')) {
                        setManualVideoId(inputVal)
                        setWorkerUrl(`${TRANSCRIPT_WORKER_URL}/transcript?v=${inputVal}`)
                        setUrl(`https://www.youtube.com/watch?v=${inputVal}`) // Set main URL too for convenience!
                      } else {
                        setUrl(inputVal)
                        const parsedId = extractVideoId(inputVal)
                        if (parsedId) {
                          setManualVideoId(parsedId)
                          setWorkerUrl(`${TRANSCRIPT_WORKER_URL}/transcript?v=${parsedId}`)
                        } else {
                          setManualVideoId(null)
                          setWorkerUrl(null)
                        }
                      }
                    }}
                    className="flex-1 rounded-lg border border-[#1E293B] bg-[#0A0F1A] px-3 py-2 font-[family-name:var(--font-geist-mono)] text-xs text-[#F1F5F9] placeholder:text-[#8B95A8]/30 focus:border-[#00D4AA]/60 focus:outline-none"
                  />
                  {(() => {
                    const currentVideoId = manualVideoId || extractVideoId(url) || extractVideoId(lastSubmittedUrl)
                    const targetWorkerUrl = workerUrl || (currentVideoId ? `${TRANSCRIPT_WORKER_URL}/transcript?v=${currentVideoId}` : null)
                    return (
                      <a
                        href={targetWorkerUrl || '#'}
                        target={targetWorkerUrl ? "_blank" : undefined}
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          if (!targetWorkerUrl) {
                            e.preventDefault()
                          }
                        }}
                        className={`rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          targetWorkerUrl
                            ? 'bg-[#00D4AA] text-[#0A0F1A] hover:bg-[#00FFD0] active:scale-[0.98]'
                            : 'bg-[#1E293B] text-[#8B95A8]/40 cursor-not-allowed'
                        }`}
                      >
                        Open in Worker ↗
                      </a>
                    )
                  })()}
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-1 text-xs text-[#8B95A8] leading-relaxed">
                <p>1. Enter YouTube URL or Video ID above and click <strong>Open in Worker</strong>.</p>
                <p>2. Copy the entire JSON response (or just the transcript value) and paste it below.</p>
              </div>

              {/* Textarea */}
              <div className="space-y-1.5">
                <textarea
                  value={manualTranscript}
                  onChange={(e) => handleTranscriptChange(e.target.value)}
                  placeholder='{"transcript": "...", ...} or raw transcript text...'
                  rows={6}
                  className="w-full rounded-xl border border-[#1E293B] bg-[#0A0F1A] px-4 py-3 font-[family-name:var(--font-geist-mono)] text-xs text-[#F1F5F9] placeholder:text-[#8B95A8]/30 focus:border-[#00D4AA]/60 focus:outline-none focus:ring-1 focus:ring-[#00D4AA]/30"
                />
                <div className="flex items-center justify-between text-[10px] text-[#8B95A8]/50 font-[family-name:var(--font-geist-mono)]">
                  <span>Characters: {manualTranscript.length.toLocaleString()}</span>
                  {manualTranscript.trim().length > 50 && (
                    <span className="text-[#00D4AA]/80 font-medium">Auto-extracted transcript!</span>
                  )}
                </div>
              </div>

              {/* Submit/Resume button */}
              <button
                type="button"
                disabled={isLoading || manualTranscript.trim().length < 20 || (!url && !lastSubmittedUrl)}
                onClick={async () => {
                  const targetUrl = url.trim() || lastSubmittedUrl.trim()
                  if (!targetUrl) return
                  // If we are resuming after a failure, we should force re-ingestion so the backend cleans up partial files
                  const isResuming = steps.length > 0 && steps.some(s => s.status === 'error')
                  await startExtraction(targetUrl, isResuming ? 'force_reingest' : 'normal', manualTranscript)
                }}
                className="w-full rounded-xl bg-[#00D4AA] px-5 py-3 text-xs font-semibold text-[#0A0F1A] transition-all hover:bg-[#00D4AA]/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Extracting...
                  </span>
                ) : (
                  <span>
                    {steps.length > 0 && steps.some(s => s.status === 'error')
                      ? 'Resume Pipeline with Paste'
                      : 'Extract with Paste'}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* ─── Pipeline Progress ─── */}
          {steps.length > 0 && (
            <div className="rounded-2xl border border-[#1E293B] bg-[#141B2D]/60 p-6 animate-fade-up">
              {/* Pipeline header */}
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#64748B]">
                    Pipeline
                  </h2>
                  {isLoading && (
                    <div className="h-1.5 w-24 rounded-full bg-[#1E293B] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#00D4AA]/60 transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
                {totalStartedAt && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-[#8B95A8]/40" />
                    <ElapsedTimer startedAt={totalStartedAt} completedAt={totalCompletedAt ?? undefined} />
                  </div>
                )}
              </div>

              {/* Steps */}
              <div className="space-y-1">
                {steps.map((step, index) => (
                  <div
                    key={step.id}
                    className={`rounded-lg px-3 py-2.5 transition-all duration-300 ${
                      step.status === 'pending'
                        ? 'opacity-30'
                        : step.status === 'running' || step.status === 'retrying'
                        ? 'bg-[#0A0F1A]/50 opacity-100'
                        : 'opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Step number */}
                      <span className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[#8B95A8]/30 w-3 text-right shrink-0">
                        {index + 1}
                      </span>

                      {/* Icon */}
                      <div className="shrink-0">
                        <StepIcon status={step.status} />
                      </div>

                      {/* Label + timer */}
                      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                        <p className={`text-sm font-medium transition-colors duration-200 ${
                          step.status === 'error' ? 'text-[#FF4D6A]'
                            : step.status === 'retrying' ? 'text-[#F59E0B]'
                            : step.status === 'done' ? 'text-[#F1F5F9]'
                            : step.status === 'running' ? 'text-[#F1F5F9]'
                            : 'text-[#8B95A8]'
                        }`}>
                          {step.label}
                        </p>

                        {step.startedAt && (
                          <ElapsedTimer startedAt={step.startedAt} completedAt={step.completedAt} />
                        )}
                      </div>
                    </div>

                    {/* Detail line */}
                    {step.detail && (
                      <div className="mt-1 ml-10 flex flex-col gap-1">
                        <p className={`text-xs font-[family-name:var(--font-geist-mono)] select-text ${
                          step.status === 'error'
                            ? 'text-[#FF4D6A]/80 whitespace-pre-wrap break-all'
                            : step.status === 'retrying'
                            ? 'text-[#F59E0B]/70'
                            : 'text-[#8B95A8]/60 truncate'
                        }`}>
                          {step.detail}
                        </p>
                        {step.id === 'duplicate_check' && step.status === 'error' && (
                          <p className="text-[11px] text-[#00D4AA] font-medium tracking-wide flex items-center gap-1.5 animate-pulse mt-0.5">
                            <span className="relative flex h-1.5 w-1.5 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D4AA] opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#00D4AA]"></span>
                            </span>
                            Existing video details and options are loaded below ↓
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Error display ─── */}
          {pipelineError && !steps.some((s) => s.status === 'error') && (
            <div className="rounded-xl border border-[#FF4D6A]/20 bg-[#FF4D6A]/5 px-5 py-4 animate-fade-up">
              <p className="text-sm text-[#FF4D6A] select-text whitespace-pre-wrap break-all">{pipelineError}</p>
            </div>
          )}

          {/* ─── Duplicate Video Card & Options ─── */}
          {isDuplicate && !isLoading && (
            <div className="space-y-6 animate-fade-up">
              {/* Nice designed element representing the duplicate video */}
              <div className="rounded-2xl border border-[#F59E0B]/20 bg-[#F59E0B]/[0.02] p-6 space-y-4 shadow-xl shadow-[#0A0F1A]/50 relative overflow-hidden group/card">
                {/* Glow effect in the background */}
                <div className="absolute -right-20 -top-20 w-48 h-48 rounded-full bg-[#F59E0B]/10 blur-3xl pointer-events-none transition-all duration-500 group-hover/card:bg-[#00D4AA]/10" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#F59E0B] group-hover/card:text-[#00D4AA] transition-colors duration-300">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F59E0B] opacity-75 group-hover/card:bg-[#00D4AA]"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F59E0B] group-hover/card:bg-[#00D4AA]"></span>
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] font-[family-name:var(--font-geist-mono)]">
                      Video Already Processed
                    </span>
                  </div>
                  <span className="text-[10px] text-[#8B95A8]/40 font-[family-name:var(--font-geist-mono)]">
                    Duplicate Check
                  </span>
                </div>
                
                <div className="flex flex-col md:flex-row gap-5 rounded-xl border border-[#1E293B] bg-[#141B2D]/80 overflow-hidden shadow-inner transition-colors duration-300 hover:border-[#2D3A4F]">
                  {/* Thumbnail on left */}
                  <div className="relative shrink-0 w-full md:w-56 aspect-video bg-[#0A0F1A] border-b md:border-b-0 md:border-r border-[#1E293B]/60 overflow-hidden">
                    <img
                      src={`https://i.ytimg.com/vi/${extractVideoId(lastSubmittedUrl) || ''}/mqdefault.jpg`}
                      alt=""
                      className="w-full h-full object-cover opacity-60 group-hover/card:scale-105 group-hover/card:opacity-75 transition-all duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A0F1A]/80 to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-[#0A0F1A]/80 flex items-center justify-center border border-[#1E293B]/60 group-hover/card:border-[#00D4AA]/40 group-hover/card:scale-110 transition-all duration-300 shadow-md">
                        <svg width="12" height="14" viewBox="0 0 16 18" fill="none" className="ml-0.5 text-[#F1F5F9] group-hover/card:text-[#00D4AA] transition-colors" aria-hidden="true">
                          <path d="M1 1.5L15 9L1 16.5V1.5Z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Content on right */}
                  <div className="flex-1 p-5 flex flex-col justify-between min-w-0">
                    <div>
                      {duplicateVideo ? (
                        <>
                          <h3 className="text-base font-semibold text-[#F1F5F9] group-hover/card:text-[#00D4AA] transition-colors duration-300 leading-snug line-clamp-2 mb-2">
                            {duplicateVideo.title || 'Untitled Video'}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-[#8B95A8] flex-wrap mb-3">
                            <span className="font-medium text-[#C8D1E0]">{duplicateVideo.channels?.channel_name || 'Unknown Channel'}</span>
                            {duplicateVideo.published_at && (
                              <>
                                <span className="text-[#1E293B]">·</span>
                                <span className="font-[family-name:var(--font-geist-mono)] text-[11px]">
                                  {new Date(duplicateVideo.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                              </>
                            )}
                          </div>
                          {duplicateVideo.video_summary && (
                            <p className="text-xs text-[#8B95A8] line-clamp-2 leading-relaxed mb-4 text-justify font-light">
                              {duplicateVideo.video_summary}
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="space-y-3">
                          <div className="h-5 bg-[#1E293B] rounded-md w-3/4 animate-pulse" />
                          <div className="flex gap-2">
                            <div className="h-3 bg-[#1E293B] rounded-md w-1/4 animate-pulse" />
                            <div className="h-3 bg-[#1E293B] rounded-md w-1/4 animate-pulse" />
                          </div>
                          <div className="h-10 bg-[#1E293B] rounded-md w-full animate-pulse" />
                        </div>
                      )}
                    </div>

                    <Link
                      href={`/video?id=${extractVideoId(lastSubmittedUrl) || ''}`}
                      className="inline-flex items-center justify-center gap-2 w-full md:w-auto rounded-xl bg-[#00D4AA] hover:bg-[#00FFD0] hover:shadow-[0_0_20px_rgba(0,212,170,0.4)] px-5 py-3 text-xs font-semibold text-[#0A0F1A] transition-all duration-300 active:scale-[0.98] shadow-md shadow-[#00D4AA]/10"
                    >
                      <span>View Video Analysis</span>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0 group-hover/card:translate-x-0.5 transition-transform" aria-hidden="true">
                        <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Re-ingestion options */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 px-1">
                  <div className="h-px bg-[#1E293B] flex-1" />
                  <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#64748B] whitespace-nowrap font-[family-name:var(--font-geist-mono)]">
                    Or Process Anyway
                  </span>
                  <div className="h-px bg-[#1E293B] flex-1" />
                </div>

                {/* Option 1: Re-extract (recommended) */}
                <button
                  onClick={handleReextract}
                  className="group w-full text-left rounded-2xl border border-[#00D4AA]/20 bg-[#00D4AA]/[0.03] p-5 transition-all duration-200 hover:border-[#00D4AA]/40 hover:bg-[#00D4AA]/[0.06] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4AA]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F1A]"
                >
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 mt-0.5 rounded-lg border border-[#00D4AA]/20 bg-[#00D4AA]/10 p-2">
                      <Sparkles className="h-4 w-4 text-[#00D4AA]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-sm font-semibold text-[#F1F5F9] group-hover:text-[#00D4AA] transition-colors">
                          Re-extract
                        </h3>
                        <span className="text-[9px] font-medium uppercase tracking-[0.15em] text-[#00D4AA]/70 border border-[#00D4AA]/20 rounded px-1.5 py-0.5 font-[family-name:var(--font-geist-mono)]">
                          Fast
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#8B95A8]">
                        Keep the existing transcript, re-run AI extraction only. Best when the video has picks but the model missed them.
                      </p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-1 text-[#475569] group-hover:text-[#00D4AA] group-hover:translate-x-0.5 transition-all" aria-hidden="true">
                      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </button>

                {/* Option 2: Full Re-ingest */}
                <button
                  onClick={handleForceReingest}
                  className="group w-full text-left rounded-2xl border border-[#1E293B] bg-[#141B2D]/40 p-5 transition-all duration-200 hover:border-[#F59E0B]/30 hover:bg-[#F59E0B]/[0.03] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F1A]"
                >
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 mt-0.5 rounded-lg border border-[#1E293B] group-hover:border-[#F59E0B]/20 bg-[#141B2D] group-hover:bg-[#F59E0B]/10 p-2 transition-colors">
                      <RotateCcw className="h-4 w-4 text-[#8B95A8] group-hover:text-[#F59E0B] transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-[#8B95A8] group-hover:text-[#F1F5F9] transition-colors">
                        Full Re-ingest
                      </h3>
                      <p className="mt-1 text-xs text-[#64748B]">
                        Delete everything and start from scratch — re-fetch transcript, re-run AI. Use when the transcript itself was bad.
                      </p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-1 text-[#475569] group-hover:text-[#F59E0B] group-hover:translate-x-0.5 transition-all" aria-hidden="true">
                      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ─── Success Result ─── */}
          {result && (
            <div className="rounded-2xl border border-[#00D4AA]/20 bg-[#00D4AA]/[0.03] p-6 animate-fade-up space-y-5">
              {/* Success header */}
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#00D4AA]" />
                <h2 className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#00D4AA]">
                  Extraction Complete
                </h2>
              </div>

              {/* Tickers — hero moment */}
              {result.tickers_extracted.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {result.tickers_extracted.map((ticker) => (
                    <Link
                      key={ticker}
                      href={`/ticker?s=${ticker}`}
                      className="group rounded-lg border border-[#00D4AA]/20 bg-[#00D4AA]/5 px-3 py-1.5 font-[family-name:var(--font-geist-mono)] text-lg font-bold tracking-wider text-[#00D4AA] hover:bg-[#00D4AA]/10 hover:border-[#00D4AA]/40 transition-all"
                    >
                      {ticker}
                    </Link>
                  ))}
                </div>
              )}

              {/* ─── AI Summary ─── */}
              {result.video_summary && (
                <div className="rounded-xl border border-[#1E293B] bg-[#0A0F1A]/60 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-3.5 w-3.5 text-[#00D4AA]/70" />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[#64748B] font-medium">AI Thesis</span>
                  </div>
                  <p className="text-sm text-[#C8D1E0] leading-relaxed font-light">
                    {result.video_summary}
                  </p>
                </div>
              )}

              {/* ─── Navigation Links ─── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Video page link */}
                <Link
                  href={`/video?id=${result.video_id}`}
                  className="group flex items-center gap-3 rounded-xl border border-[#1E293B] bg-[#141B2D]/60 p-4 hover:border-[#00D4AA]/30 hover:bg-[#141B2D] transition-all duration-200"
                >
                  {/* Thumbnail */}
                  <div className="shrink-0 relative w-16 h-10 rounded-md overflow-hidden bg-[#0A0F1A] border border-[#1E293B]/60">
                    <img
                      src={`https://i.ytimg.com/vi/${result.video_id}/mqdefault.jpg`}
                      alt=""
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-90 transition-opacity duration-200"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-[#0A0F1A]/80 flex items-center justify-center">
                        <svg width="7" height="8" viewBox="0 0 16 18" fill="none" className="ml-0.5 text-[#F1F5F9]" aria-hidden="true">
                          <path d="M1 1.5L15 9L1 16.5V1.5Z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#F1F5F9] group-hover:text-[#00D4AA] transition-colors truncate">
                      {result.title || 'View video analysis'}
                    </p>
                    <p className="text-[11px] text-[#475569] mt-0.5">Video page →</p>
                  </div>
                </Link>

                {/* Channel page link */}
                {result.channel_id ? (
                  <Link
                    href={`/channel?id=${result.channel_id}`}
                    className="group flex items-center gap-3 rounded-xl border border-[#1E293B] bg-[#141B2D]/60 p-4 hover:border-[#00D4AA]/30 hover:bg-[#141B2D] transition-all duration-200"
                  >
                    <div className="shrink-0 w-10 h-10 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/20 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-[#00D4AA]/70 group-hover:text-[#00D4AA] transition-colors" aria-hidden="true">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#F1F5F9] group-hover:text-[#00D4AA] transition-colors truncate">
                        {result.channel_name}
                      </p>
                      <p className="text-[11px] text-[#475569] mt-0.5">Channel page →</p>
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border border-[#1E293B] bg-[#141B2D]/30 p-4">
                    <div className="shrink-0 w-10 h-10 rounded-full bg-[#141B2D] border border-[#1E293B] flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-[#475569]" aria-hidden="true">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#8B95A8] truncate">{result.channel_name}</p>
                      <p className="text-[11px] text-[#475569] mt-0.5">Analyst</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Metadata row */}
              <dl className="space-y-2.5 text-sm border-t border-[#1E293B] pt-4">
                <div className="flex justify-between">
                  <dt className="text-[#64748B]">Published</dt>
                  <dd className="font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">
                    {new Date(result.published_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#64748B]">Recommendations</dt>
                  <dd className="font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">{result.recommendation_count}</dd>
                </div>
                {totalStartedAt && totalCompletedAt && (
                  <div className="flex justify-between pt-2.5 border-t border-[#1E293B]">
                    <dt className="text-[#64748B]">Total time</dt>
                    <dd className="font-[family-name:var(--font-geist-mono)] text-[#8B95A8]">
                      {formatElapsed(totalCompletedAt - totalStartedAt)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}


export default function IngestPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0A0F1A]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-5 w-5 animate-spin text-[#00D4AA]/60" />
            <p className="text-xs text-[#64748B] tracking-wide">Loading...</p>
          </div>
        </div>
      }
    >
      <IngestContent />
    </Suspense>
  )
}
