'use client'

import { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, XCircle, Loader2, Circle, RefreshCw, LogOut, Clock, Zap, RotateCcw, Sparkles, AlertTriangle, Trash2, Play, X } from 'lucide-react'

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

interface FailedIngestion {
  url: string
  error: string
  timestamp: number
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


export interface JobConfig {
  id: string
  url: string
  mode: 'normal' | 'reextract' | 'force_reingest'
  manualTranscriptText?: string
}



function JobCard({
  config,
  onDismiss,
  onFailed,
  onSuccess,
  isDemo,
}: {
  config: JobConfig
  onDismiss: (id: string) => void
  onFailed: (url: string, error: string) => void
  onSuccess: (url: string) => void
  isDemo: boolean
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS.map(s => ({ ...s, status: 'pending', detail: undefined, startedAt: undefined, completedAt: undefined })))
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [pipelineError, setPipelineError] = useState('')
  const [isDuplicate, setIsDuplicate] = useState(false)
  const [duplicateVideo, setDuplicateVideo] = useState<any | null>(null)
  const [totalStartedAt, setTotalStartedAt] = useState<number | null>(null)
  const [totalCompletedAt, setTotalCompletedAt] = useState<number | null>(null)
  const [showManualPaste, setShowManualPaste] = useState(false)
  const [manualTranscript, setManualTranscript] = useState('')
  const [manualVideoId, setManualVideoId] = useState<string | null>(null)
  const [workerUrl, setWorkerUrl] = useState<string | null>(null)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

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
    if (!isDuplicate) {
      setDuplicateVideo(null)
      return
    }

    if (isDemo) {
      setDuplicateVideo({
        video_id: 'demo-id',
        youtube_video_id: extractVideoId(config.url) || 'dQw4w9WgXcQ',
        title: 'Top 3 Stocks to Watch in 2025 — AAPL, NVDA & MSFT Deep Dive',
        published_at: '2025-06-10T14:30:00Z',
        video_summary: 'The analyst is strongly bullish on AI infrastructure plays...',
        channels: { channel_name: 'Financial Analysis TV' }
      })
      return
    }

    const videoId = extractVideoId(config.url)
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
  }, [isDuplicate, config.url, isDemo])

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

  const startExtraction = async (
    mode: 'normal' | 'reextract' | 'force_reingest',
    manualTranscriptText?: string
  ) => {
    setIsLoading(true)
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: 'pending', detail: undefined, startedAt: undefined, completedAt: undefined })))
    setResult(null)
    setPipelineError('')
    setIsDuplicate(false)
    setDuplicateVideo(null)
    setTotalStartedAt(Date.now())
    setTotalCompletedAt(null)

    if (isDemo) {
      const isDuplicateDemo = false // simplify for multi-job demo
      for (const event of DEMO_EVENTS) {
        if (abortController?.signal.aborted) return
        await new Promise((resolve) => setTimeout(resolve, event.delay))
        if (abortController?.signal.aborted) return
        updateStep(event.step, event.status as StepStatus, event.detail)
      }
      await new Promise((resolve) => setTimeout(resolve, 300))
      if (abortController?.signal.aborted) return
      setResult(DEMO_RESULT)
      setTotalCompletedAt(Date.now())
      setIsLoading(false)
      onSuccess(config.url)
      return
    }

    const controller = new AbortController()
    setAbortController(controller)
    abortControllerRef.current = controller

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        const err = 'Session expired. Please log in again.'
        setPipelineError(err)
        onFailed(config.url, err)
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
            youtube_url: config.url,
            ...(mode === 'force_reingest' && { force_reingest: true }),
            ...(mode === 'reextract' && { reextract_only: true }),
            ...(manualTranscriptText && { transcript: manualTranscriptText }),
          }),
          signal: controller.signal
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errMsg = errorData?.detail || `Request failed (${response.status})`
        setPipelineError(errMsg)
        onFailed(config.url, errMsg)
        setIsLoading(false)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        setPipelineError('Streaming not supported')
        onFailed(config.url, 'Streaming not supported')
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
                onSuccess(config.url)
              } else if (event.status === 'error') {
                updateStep(event.step, 'error', event.detail)
                setPipelineError(event.detail || 'An error occurred')
                onFailed(config.url, event.detail || 'An error occurred')
                if (event.step === 'duplicate_check' && event.detail === 'Video already processed') {
                  setIsDuplicate(true)
                }
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
              // skip
            }
          }
        }
      }

      setSteps((prev) => {
        const hasError = prev.some((s) => s.status === 'error')
        if (!hasError) {
          setManualTranscript('')
          setShowManualPaste(false)
        }
        return prev
      })
    } catch (e: any) {
      if (abortControllerRef.current !== controller) return // Superceded by a newer run
      
      if (e.name === 'AbortError') {
        setPipelineError('Ingestion cancelled by user.')
        setTotalCompletedAt(Date.now())
        // mark running steps as error
        setSteps(prev => prev.map(s => s.status === 'running' || s.status === 'retrying' ? { ...s, status: 'error', detail: 'Cancelled' } : s))
      } else {
        setPipelineError('Network error. Check your connection and try again.')
        onFailed(config.url, 'Network error. Check your connection and try again.')
        setTotalCompletedAt(Date.now())
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false)
        setAbortController(null)
      }
    }
  }

  // start on mount
  useEffect(() => {
    startExtraction(config.mode, config.manualTranscriptText)
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCancel = () => {
    if (abortController) {
      abortController.abort()
    }
  }

  const StepIcon = ({ status }: { status: StepStatus }) => {
    switch (status) {
      case 'done': return <CheckCircle2 className="h-4 w-4 text-[#00D4AA]" />
      case 'error': return <XCircle className="h-4 w-4 text-[#FF4D6A]" />
      case 'running': return <Loader2 className="h-4 w-4 animate-spin text-[#00D4AA]" />
      case 'retrying': return <RefreshCw className="h-4 w-4 animate-spin text-[#F59E0B]" />
      default: return <Circle className="h-4 w-4 text-[#8B95A8]/20" />
    }
  }

  const completedCount = steps.filter(s => s.status === 'done').length
  const totalSteps = steps.length
  const progress = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0

  return (
    <div className="rounded-2xl border border-[#1E293B] bg-[#141B2D]/60 p-6 animate-fade-up relative overflow-hidden group shadow-lg shadow-[#0A0F1A]/50">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1E293B]/20 to-transparent pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 relative z-10">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold font-[family-name:var(--font-geist-mono)] text-[#00D4AA]">
              {result ? 'Completed' : isLoading ? 'Processing' : 'Stopped'}
            </span>
            <span className="text-[#1E293B]">·</span>
            <span className="text-[10px] text-[#64748B] font-[family-name:var(--font-geist-mono)] truncate">
              {config.id}
            </span>
          </div>
          <h3 className="text-sm font-medium text-[#F1F5F9] truncate" title={config.url}>
            {config.url}
          </h3>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          {isLoading && (
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#FF4D6A]/10 text-[#FF4D6A] hover:bg-[#FF4D6A]/20 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => onDismiss(config.id)}
            className="p-1.5 text-[#8B95A8] hover:text-[#F1F5F9] hover:bg-[#1E293B] rounded-lg transition-colors"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Manual paste panel */}
      {showManualPaste && (
        <div className="mb-6 rounded-2xl border border-[#00D4AA]/20 bg-[#00D4AA]/[0.02] p-5 space-y-4 relative z-10">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#00D4AA]" />
            <h3 className="text-sm font-semibold text-[#F1F5F9]">Manual Transcript Fallback</h3>
          </div>
          <div className="space-y-1.5 bg-[#0A0F1A]/40 border border-[#1E293B] rounded-xl p-4">
            <label className="text-[11px] font-semibold text-[#8B95A8] block">YouTube URL or Video ID</label>
            <div className="flex gap-2">
              <input type="text" readOnly value={config.url} className="flex-1 rounded-lg border border-[#1E293B] bg-[#0A0F1A] px-3 py-2 font-[family-name:var(--font-geist-mono)] text-xs text-[#F1F5F9]" />
              {(() => {
                const currentVideoId = manualVideoId || extractVideoId(config.url)
                const targetWorkerUrl = workerUrl || (currentVideoId ? `${TRANSCRIPT_WORKER_URL}/transcript?v=${currentVideoId}` : null)
                return (
                  <a href={targetWorkerUrl || '#'} target={targetWorkerUrl ? "_blank" : undefined} className={`rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-all ${targetWorkerUrl ? 'bg-[#00D4AA] text-[#0A0F1A] hover:bg-[#00FFD0]' : 'bg-[#1E293B] text-[#8B95A8]/40'}`}>
                    Open ↗
                  </a>
                )
              })()}
            </div>
          </div>
          <textarea value={manualTranscript} onChange={(e) => handleTranscriptChange(e.target.value)} placeholder='Paste raw transcript text...' rows={4} className="w-full rounded-xl border border-[#1E293B] bg-[#0A0F1A] px-4 py-3 font-[family-name:var(--font-geist-mono)] text-xs text-[#F1F5F9]" />
          <button type="button" disabled={isLoading || manualTranscript.trim().length < 20} onClick={() => startExtraction('force_reingest', manualTranscript)} className="w-full rounded-xl bg-[#00D4AA] px-5 py-3 text-xs font-semibold text-[#0A0F1A] hover:bg-[#00D4AA]/90 disabled:opacity-40">
            {isLoading ? 'Extracting...' : 'Extract with Paste'}
          </button>
        </div>
      )}

      {/* Error & Duplicate options */}
      {pipelineError && !steps.some((s) => s.status === 'error') && (
        <div className="mb-6 rounded-xl border border-[#FF4D6A]/20 bg-[#FF4D6A]/5 px-5 py-4 relative z-10">
          <p className="text-sm text-[#FF4D6A] whitespace-pre-wrap break-all">{pipelineError}</p>
        </div>
      )}

      {isDuplicate && !isLoading && (
        <div className="mb-6 space-y-4 relative z-10">
          <div className="rounded-xl border border-[#1E293B] bg-[#0A0F1A]/60 p-4">
            <h4 className="text-xs font-bold text-[#F59E0B] uppercase tracking-wider mb-2">Duplicate Found</h4>
            <div className="flex gap-4">
              <img src={`https://i.ytimg.com/vi/${extractVideoId(config.url) || ''}/mqdefault.jpg`} alt="" className="w-24 h-16 object-cover rounded bg-[#1E293B]" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#F1F5F9] truncate">{duplicateVideo?.title || 'Unknown Title'}</p>
                <Link href={`/video?id=${extractVideoId(config.url) || ''}`} className="text-xs text-[#00D4AA] hover:underline mt-1 inline-block">View Video →</Link>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => startExtraction('reextract')} className="flex-1 rounded-lg border border-[#00D4AA]/20 bg-[#00D4AA]/10 py-2.5 text-xs font-semibold text-[#00D4AA] hover:bg-[#00D4AA]/20">Re-extract (Fast)</button>
            <button onClick={() => startExtraction('force_reingest')} className="flex-1 rounded-lg border border-[#F59E0B]/20 bg-[#F59E0B]/10 py-2.5 text-xs font-semibold text-[#F59E0B] hover:bg-[#F59E0B]/20">Full Re-ingest</button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mb-6 rounded-xl border border-[#00D4AA]/20 bg-[#00D4AA]/[0.03] p-5 space-y-4 relative z-10">
          <div className="flex flex-wrap gap-2">
            {result.tickers_extracted.map((ticker) => (
              <Link key={ticker} href={`/ticker?s=${ticker}`} className="rounded-md bg-[#00D4AA]/10 px-2.5 py-1 text-xs font-bold text-[#00D4AA] hover:bg-[#00D4AA]/20">
                {ticker}
              </Link>
            ))}
            {result.tickers_extracted.length === 0 && <span className="text-xs text-[#8B95A8]">No tickers found.</span>}
          </div>
          <div className="flex gap-3 mt-3">
            <Link href={`/video?id=${result.video_id}`} className="text-xs text-[#00D4AA] hover:underline">View Video →</Link>
            {result.channel_id && <Link href={`/channel?id=${result.channel_id}`} className="text-xs text-[#00D4AA] hover:underline">View Channel →</Link>}
          </div>
        </div>
      )}

      {/* Pipeline Progress */}
      <div className="relative z-10">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3 w-full">
            <h2 className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#64748B] shrink-0">Pipeline</h2>
            {isLoading && (
              <div className="h-1 flex-1 rounded-full bg-[#0A0F1A] overflow-hidden">
                <div className="h-full rounded-full bg-[#00D4AA]/60 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
          {totalStartedAt && (
            <div className="flex items-center gap-1.5 ml-4 shrink-0">
              <Clock className="h-3 w-3 text-[#8B95A8]/40" />
              <ElapsedTimer startedAt={totalStartedAt} completedAt={totalCompletedAt ?? undefined} />
            </div>
          )}
        </div>
        <div className="space-y-1">
          {steps.map((step, index) => (
            <div key={step.id} className={`rounded-lg px-2.5 py-2 transition-all duration-300 ${step.status === 'pending' ? 'opacity-30' : 'opacity-100'}`}>
              <div className="flex items-center gap-3">
                <span className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[#8B95A8]/30 w-3 text-right shrink-0">{index + 1}</span>
                <div className="shrink-0"><StepIcon status={step.status} /></div>
                <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                  <p className={`text-xs font-medium ${step.status === 'error' ? 'text-[#FF4D6A]' : step.status === 'retrying' ? 'text-[#F59E0B]' : step.status === 'done' || step.status === 'running' ? 'text-[#F1F5F9]' : 'text-[#8B95A8]'}`}>
                    {step.label}
                  </p>
                  {step.startedAt && <ElapsedTimer startedAt={step.startedAt} completedAt={step.completedAt} />}
                </div>
              </div>
              {step.detail && (
                <div className="mt-1 ml-9">
                  <p className={`text-[10px] font-[family-name:var(--font-geist-mono)] ${step.status === 'error' ? 'text-[#FF4D6A]/80' : 'text-[#8B95A8]/60 truncate'}`}>
                    {step.detail}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}



function IngestContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isDemo = searchParams.get('demo') === '1'
  const [url, setUrl] = useState('')
  const [validationError, setValidationError] = useState('')
  const [authChecked, setAuthChecked] = useState(isDemo)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  
  const [jobs, setJobs] = useState<JobConfig[]>([])
  const [failedIngestions, setFailedIngestions] = useState<FailedIngestion[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('aura_failed_ingestions')
      if (stored) {
        setFailedIngestions(JSON.parse(stored))
      }
    } catch {}
  }, [])

  const addFailedIngestion = useCallback((failedUrl: string, errorMsg: string) => {
    setFailedIngestions(prev => {
      const filtered = prev.filter(f => f.url !== failedUrl)
      const updated = [{ url: failedUrl, error: errorMsg, timestamp: Date.now() }, ...filtered].slice(0, 20)
      localStorage.setItem('aura_failed_ingestions', JSON.stringify(updated))
      return updated
    })
  }, [])

  const removeFailedIngestion = useCallback((successUrl: string) => {
    setFailedIngestions(prev => {
      const updated = prev.filter(f => f.url !== successUrl)
      localStorage.setItem('aura_failed_ingestions', JSON.stringify(updated))
      return updated
    })
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validateUrl(url)) return
    
    const newJob: JobConfig = {
      id: Math.random().toString(36).substring(2, 9),
      url: url.trim(),
      mode: 'normal'
    }
    setJobs(prev => [newJob, ...prev])
    setUrl('')
  }

  const handleDismissJob = useCallback((id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id))
  }, [])

  const handleJobFailed = useCallback((failedUrl: string, errorMsg: string) => {
    addFailedIngestion(failedUrl, errorMsg)
  }, [addFailedIngestion])

  const handleJobSuccess = useCallback((successUrl: string) => {
    removeFailedIngestion(successUrl)
  }, [removeFailedIngestion])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/admin/login')
  }

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
        <div className="mx-auto w-full max-w-4xl space-y-12">
          {/* ─── Page heading & Form ─── */}
          <div className="space-y-8">
            <div className="animate-hero-rise">
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-[#F1F5F9]">
                Ingest
              </h1>
              <p className="mt-3 text-base text-[#8B95A8]">
                Drop YouTube URLs. They will run concurrently.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 animate-fade-up stagger-2">
              <div className="relative flex gap-3">
                <div className="relative flex-1">
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
                    className="w-full rounded-xl border border-[#1E293B] bg-[#141B2D] px-4 py-3.5 font-[family-name:var(--font-geist-mono)] text-sm text-[#F1F5F9] placeholder:text-[#8B95A8]/40 focus:border-[#00D4AA]/60 focus:outline-none focus:ring-1 focus:ring-[#00D4AA]/30 transition-all duration-200"
                    aria-describedby={validationError ? 'url-error' : undefined}
                    aria-invalid={validationError ? true : undefined}
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-xl border border-transparent opacity-0 peer-focus:opacity-100 transition-opacity" />
                </div>
                <button
                  type="submit"
                  disabled={!url.trim()}
                  className="group relative rounded-xl bg-[#00D4AA] px-8 py-3.5 text-sm font-semibold text-[#0A0F1A] transition-all duration-200 hover:bg-[#00D4AA]/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4AA]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F1A]"
                >
                  <span className="flex items-center justify-center gap-2">
                    <Zap className="h-4 w-4" />
                    Extract
                  </span>
                </button>
              </div>

              {validationError && (
                <p id="url-error" className="text-sm text-[#FF4D6A] animate-fade-up" role="alert">
                  {validationError}
                </p>
              )}
            </form>
          </div>

          {/* ─── Active Jobs ─── */}
          {jobs.length > 0 && (
            <div className="space-y-6 animate-fade-up">
              <div className="flex items-center gap-3">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#64748B]">Active Jobs</h2>
                <div className="h-px bg-[#1E293B] flex-1" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {jobs.map(job => (
                  <JobCard 
                    key={job.id} 
                    config={job} 
                    onDismiss={handleDismissJob}
                    onFailed={handleJobFailed}
                    onSuccess={handleJobSuccess}
                    isDemo={isDemo}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ─── Failed Ingestions ─── */}
          {failedIngestions.length > 0 && (
            <div className="mt-12 animate-fade-up">
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[#FF4D6A]" />
                  <h3 className="text-sm font-semibold text-[#F1F5F9]">
                    Failed Ingestions
                  </h3>
                  <span className="ml-2 rounded-full bg-[#1E293B] px-2 py-0.5 text-[10px] font-medium text-[#8B95A8]">
                    {failedIngestions.length}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setFailedIngestions([])
                    localStorage.removeItem('aura_failed_ingestions')
                  }}
                  className="text-xs text-[#8B95A8] hover:text-[#FF4D6A] transition-colors"
                >
                  Clear all
                </button>
              </div>

              <div className="grid gap-3">
                {failedIngestions.map((failed) => (
                  <div key={failed.url} className="group relative rounded-xl border border-[#1E293B] bg-[#141B2D]/40 p-4 transition-all hover:border-[#FF4D6A]/30 hover:bg-[#141B2D]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] text-[#64748B] font-[family-name:var(--font-geist-mono)]">
                            {new Date(failed.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-[#F1F5F9] truncate font-[family-name:var(--font-geist-mono)]">
                          {failed.url}
                        </p>
                        <p className="text-xs text-[#FF4D6A]/80 mt-1 line-clamp-2">
                          {failed.error}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setJobs(prev => [{
                              id: Math.random().toString(36).substring(2, 9),
                              url: failed.url,
                              mode: 'normal'
                            }, ...prev])
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
                          className="flex items-center gap-1.5 rounded-lg bg-[#00D4AA]/10 px-3 py-2 text-xs font-semibold text-[#00D4AA] hover:bg-[#00D4AA]/20 transition-colors"
                        >
                          <Play className="h-3.5 w-3.5" />
                          Retry
                        </button>
                        <button
                          onClick={() => removeFailedIngestion(failed.url)}
                          className="p-2 rounded-lg text-[#8B95A8] hover:text-[#FF4D6A] hover:bg-[#FF4D6A]/10 transition-colors"
                          aria-label="Remove from list"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
