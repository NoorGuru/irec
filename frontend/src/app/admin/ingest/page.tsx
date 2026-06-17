'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Loader2, Circle, RefreshCw } from 'lucide-react'

const YOUTUBE_URL_REGEX =
  /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?.*v=|^(https?:\/\/)?youtu\.be\/|^(https?:\/\/)?(www\.)?youtube\.com\/shorts\//

type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'retrying'

interface PipelineStep {
  id: string
  label: string
  status: StepStatus
  detail?: string
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

// --- Demo mode: simulates the SSE stream with fake data and delays ---
const DEMO_EVENTS: { step: string; status: string; detail: string; delay: number }[] = [
  { step: 'url_parse', status: 'running', detail: 'Parsing YouTube URL...', delay: 0 },
  { step: 'url_parse', status: 'done', detail: 'Video ID: dQw4w9WgXcQ', delay: 400 },
  { step: 'duplicate_check', status: 'running', detail: 'Checking for duplicates...', delay: 200 },
  { step: 'duplicate_check', status: 'done', detail: 'New video confirmed', delay: 600 },
  { step: 'metadata', status: 'running', detail: 'Fetching video metadata...', delay: 200 },
  { step: 'metadata', status: 'done', detail: 'Channel: Financial Analysis TV', delay: 900 },
  { step: 'transcript', status: 'running', detail: 'Fetching transcript...', delay: 200 },
  { step: 'transcript', status: 'done', detail: '~4,230 words', delay: 1200 },
  { step: 'llm_parse', status: 'running', detail: 'Extracting recommendations via AI...', delay: 300 },
  { step: 'llm_parse', status: 'done', detail: 'Found 3 ticker(s): AAPL, NVDA, MSFT', delay: 2500 },
  { step: 'database', status: 'running', detail: 'Saving to database...', delay: 200 },
  { step: 'database', status: 'done', detail: 'Persisted successfully', delay: 500 },
]

const DEMO_RESULT: ExtractionResult = {
  channel_name: 'Financial Analysis TV',
  video_id: 'dQw4w9WgXcQ',
  published_at: '2025-06-10T14:30:00Z',
  tickers_extracted: ['AAPL', 'NVDA', 'MSFT'],
  recommendation_count: 3,
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

  useEffect(() => {
    // In demo mode, skip auth check
    if (isDemo) {
      // Auth is handled synchronously below via initial state
      return
    }
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
      setAuthChecked(true)
    }
    checkAuth()
  }, [router, isDemo])

  const validateUrl = (value: string): boolean => {
    if (!value.trim()) {
      setValidationError('Please enter a YouTube URL.')
      return false
    }
    if (!YOUTUBE_URL_REGEX.test(value.trim())) {
      setValidationError(
        'Invalid URL format. Supported: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/'
      )
      return false
    }
    setValidationError('')
    return true
  }

  const updateStep = useCallback((stepId: string, status: StepStatus, detail?: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, status, detail } : s))
    )
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateUrl(url)) return

    setIsLoading(true)
    setValidationError('')
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: 'pending', detail: undefined })))
    setResult(null)
    setPipelineError('')

    // --- Demo mode: simulate the pipeline with delays ---
    if (isDemo) {
      for (const event of DEMO_EVENTS) {
        await new Promise((resolve) => setTimeout(resolve, event.delay))
        updateStep(event.step, event.status as StepStatus, event.detail)
      }
      // Small pause before showing result
      await new Promise((resolve) => setTimeout(resolve, 300))
      setResult(DEMO_RESULT)
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
              } else if (event.status === 'error') {
                updateStep(event.step, 'error', event.detail)
                setPipelineError(event.detail || 'An error occurred')
              } else {
                updateStep(event.step, event.status, event.detail)
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }
      }

      // If we got a result, clear the URL
      setSteps((prev) => {
        const hasError = prev.some((s) => s.status === 'error')
        if (!hasError) setUrl('')
        return prev
      })
    } catch {
      setPipelineError('Network error. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const StepIcon = ({ status }: { status: StepStatus }) => {
    switch (status) {
      case 'done':
        return <CheckCircle2 className="h-5 w-5 text-[#00D4AA]" />
      case 'error':
        return <XCircle className="h-5 w-5 text-[#FF4D6A]" />
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-[#00D4AA]" />
      case 'retrying':
        return <RefreshCw className="h-5 w-5 animate-spin text-[#F59E0B]" />
      default:
        return <Circle className="h-5 w-5 text-[#8B95A8]/40" />
    }
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0F1A]">
        <p className="text-[#8B95A8]">Checking auth...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0F1A] p-4">
      <div className="w-full max-w-xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[#F1F5F9]">
            Ingest
          </h1>
          {isDemo && (
            <p className="mt-1 text-xs font-mono text-[#00D4AA]/70 uppercase tracking-wider">
              Demo Mode — no real API calls
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="youtube-url" className="mb-1.5 block text-sm font-medium text-[#8B95A8]">
              YouTube URL
            </label>
            <input
              id="youtube-url"
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                if (validationError) setValidationError('')
              }}
              maxLength={2048}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full rounded-md border border-[#1E293B] bg-[#141B2D] px-3 py-2.5 font-mono text-sm text-[#F1F5F9] placeholder:text-[#8B95A8]/50 focus:border-[#00D4AA] focus:outline-none focus:ring-1 focus:ring-[#00D4AA]/50 disabled:opacity-50"
              disabled={isLoading}
              aria-describedby={validationError ? 'url-error' : undefined}
              aria-invalid={validationError ? true : undefined}
            />
            {validationError && (
              <p id="url-error" className="mt-1.5 text-sm text-[#FF4D6A]" role="alert">
                {validationError}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-[#00D4AA] text-[#0A0F1A] font-semibold hover:bg-[#00D4AA]/90 disabled:opacity-50"
            size="lg"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </span>
            ) : (
              'Extract'
            )}
          </Button>
        </form>

        {/* Pipeline Progress */}
        {steps.length > 0 && (
          <div className="rounded-lg border border-[#1E293B] bg-[#141B2D] p-5">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[#8B95A8]">
              Pipeline
            </h2>
            <div className="space-y-3">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={`flex items-start gap-3 transition-opacity duration-200 ${
                    step.status === 'pending' ? 'opacity-40' : 'opacity-100'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    <StepIcon status={step.status} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${
                      step.status === 'error' ? 'text-[#FF4D6A]'
                        : step.status === 'retrying' ? 'text-[#F59E0B]'
                        : 'text-[#F1F5F9]'
                    }`}>
                      {step.label}
                    </p>
                    {step.detail && (
                      <p className={`mt-0.5 text-xs select-text ${
                        step.status === 'error'
                          ? 'text-[#FF4D6A]/80 whitespace-pre-wrap break-all'
                          : step.status === 'retrying'
                          ? 'text-[#F59E0B]/80'
                          : 'truncate text-[#8B95A8]'
                      }`}>
                        {step.detail}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error display */}
        {pipelineError && !steps.some((s) => s.status === 'error') && (
          <div className="rounded-lg border border-[#FF4D6A]/30 bg-[#FF4D6A]/10 px-4 py-3">
            <p className="text-sm text-[#FF4D6A] select-text whitespace-pre-wrap break-all">{pipelineError}</p>
          </div>
        )}

        {/* Success Result */}
        {result && (
          <div className="rounded-lg border border-[#00D4AA]/30 bg-[#00D4AA]/5 p-5">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[#00D4AA]">
              Extraction Complete
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[#8B95A8]">Channel</dt>
                <dd className="font-medium text-[#F1F5F9]">{result.channel_name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#8B95A8]">Published</dt>
                <dd className="font-mono text-[#F1F5F9]">
                  {new Date(result.published_at).toLocaleDateString()}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#8B95A8]">Tickers</dt>
                <dd className="font-mono font-semibold tracking-wide text-[#00D4AA]">
                  {result.tickers_extracted.length > 0
                    ? result.tickers_extracted.join(', ')
                    : 'None found'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#8B95A8]">Recommendations</dt>
                <dd className="font-mono text-[#F1F5F9]">{result.recommendation_count}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </div>
  )
}


export default function IngestPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0A0F1A]">
          <p className="text-[#8B95A8]">Loading...</p>
        </div>
      }
    >
      <IngestContent />
    </Suspense>
  )
}
