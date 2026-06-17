'use client'

import { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, XCircle, Loader2, Circle, RefreshCw, LogOut, Clock, Zap } from 'lucide-react'

const YOUTUBE_URL_REGEX =
  /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?.*v=|^(https?:\/\/)?youtu\.be\/|^(https?:\/\/)?(www\.)?youtube\.com\/shorts\//

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
  video_id: string
  published_at: string
  tickers_extracted: string[]
  recommendation_count: number
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
  video_id: 'dQw4w9WgXcQ',
  published_at: '2025-06-10T14:30:00Z',
  tickers_extracted: ['AAPL', 'NVDA', 'MSFT'],
  recommendation_count: 3,
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
  const [authChecked, setAuthChecked] = useState(isDemo)
  const [totalStartedAt, setTotalStartedAt] = useState<number | null>(null)
  const [totalCompletedAt, setTotalCompletedAt] = useState<number | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

    setIsLoading(true)
    setValidationError('')
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: 'pending', detail: undefined, startedAt: undefined, completedAt: undefined })))
    setResult(null)
    setPipelineError('')
    setTotalStartedAt(Date.now())
    setTotalCompletedAt(null)

    // --- Demo mode ---
    if (isDemo) {
      for (const event of DEMO_EVENTS) {
        await new Promise((resolve) => setTimeout(resolve, event.delay))
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
          body: JSON.stringify({ youtube_url: url.trim() }),
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
        if (!hasError) setUrl('')
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
                      <p className={`mt-1 ml-10 text-xs font-[family-name:var(--font-geist-mono)] select-text ${
                        step.status === 'error'
                          ? 'text-[#FF4D6A]/80 whitespace-pre-wrap break-all'
                          : step.status === 'retrying'
                          ? 'text-[#F59E0B]/70'
                          : 'text-[#8B95A8]/60 truncate'
                      }`}>
                        {step.detail}
                      </p>
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

          {/* ─── Success Result ─── */}
          {result && (
            <div className="rounded-2xl border border-[#00D4AA]/20 bg-[#00D4AA]/[0.03] p-6 animate-fade-up">
              {/* Success header */}
              <div className="flex items-center gap-2 mb-5">
                <CheckCircle2 className="h-4 w-4 text-[#00D4AA]" />
                <h2 className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#00D4AA]">
                  Extraction Complete
                </h2>
              </div>

              {/* Tickers — the hero moment */}
              {result.tickers_extracted.length > 0 && (
                <div className="mb-5 flex flex-wrap gap-2">
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

              {/* Metadata */}
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[#64748B]">Channel</dt>
                  <dd className="font-medium text-[#F1F5F9]">{result.channel_name}</dd>
                </div>
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
