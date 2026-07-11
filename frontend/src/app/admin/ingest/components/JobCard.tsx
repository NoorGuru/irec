import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, XCircle, Loader2, Circle, RefreshCw, X, Sparkles, Clock } from 'lucide-react'
import { JobConfig, PipelineStep, ExtractionResult, StepStatus } from './types'
import { extractVideoId, INITIAL_STEPS, TRANSCRIPT_WORKER_URL, DEMO_EVENTS, DEMO_RESULT } from './utils'
import { ElapsedTimer } from './ElapsedTimer'

export function JobCard({
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
    <div className="rounded-2xl border border-[#1E293B] bg-[#141B2D]/60 p-6 animate-fade-up relative overflow-hidden group shadow-lg shadow-[#0A0F1A]/50 queue-card-hover">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1E293B]/20 to-transparent pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 relative z-10">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-[10px] uppercase tracking-[0.2em] font-bold font-[family-name:var(--font-geist-mono)] ${pipelineError ? 'text-[#FF4D6A]' : result ? 'text-[#00D4AA]' : isLoading ? 'text-[#F59E0B]' : 'text-[#64748B]'}`}>
              {pipelineError ? 'Error' : result ? 'Completed' : isLoading ? 'Processing' : 'Stopped'}
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

      {/* Duplicate options inline */}
      {isDuplicate && !isLoading && (
        <div className="mb-6 space-y-4 relative z-10 animate-fade-up">
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
        <div className="mb-6 rounded-xl border border-[#00D4AA]/20 bg-[#00D4AA]/[0.03] p-5 space-y-4 relative z-10 animate-fade-up">
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
            <div key={step.id} className="relative">
              <div className={`rounded-lg px-2.5 py-2 transition-all duration-300 ${step.status === 'pending' ? 'opacity-30' : 'opacity-100'}`}>
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
                    <p className={`text-[10px] font-[family-name:var(--font-geist-mono)] ${step.status === 'error' ? 'text-[#FF4D6A]/80' : 'text-[#8B95A8]/60'} whitespace-pre-wrap`}>
                      {step.detail}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Inline manual transcript fallback */}
              {step.id === 'transcript' && showManualPaste && (
                <div className="animate-inline-expand overflow-hidden ml-9 mr-2 mb-2">
                  <div className="rounded-xl border border-[#00D4AA]/20 bg-[#00D4AA]/[0.02] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-[#00D4AA]" />
                        <h4 className="text-xs font-semibold text-[#F1F5F9]">Manual Fallback</h4>
                      </div>
                      {(() => {
                        const currentVideoId = manualVideoId || extractVideoId(config.url)
                        const targetWorkerUrl = workerUrl || (currentVideoId ? `${TRANSCRIPT_WORKER_URL}/transcript?v=${currentVideoId}` : null)
                        return (
                          <a href={targetWorkerUrl || '#'} target={targetWorkerUrl ? "_blank" : undefined} className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors ${targetWorkerUrl ? 'bg-[#00D4AA] text-[#0A0F1A] hover:bg-[#00FFD0]' : 'bg-[#1E293B] text-[#8B95A8]/40'}`}>
                            Worker ↗
                          </a>
                        )
                      })()}
                    </div>
                    <textarea 
                      value={manualTranscript} 
                      onChange={(e) => handleTranscriptChange(e.target.value)} 
                      placeholder='Paste raw transcript JSON or text...' 
                      rows={3} 
                      className="w-full rounded-lg border border-[#1E293B] bg-[#0A0F1A] px-3 py-2 font-[family-name:var(--font-geist-mono)] text-[11px] text-[#F1F5F9] focus:outline-none focus:border-[#00D4AA]/50" 
                    />
                    <button 
                      type="button" 
                      disabled={isLoading || manualTranscript.trim().length < 20} 
                      onClick={() => startExtraction('force_reingest', manualTranscript)} 
                      className="w-full rounded-lg bg-[#00D4AA] px-4 py-2 text-xs font-semibold text-[#0A0F1A] hover:bg-[#00D4AA]/90 disabled:opacity-40 transition-colors"
                    >
                      {isLoading ? 'Extracting...' : 'Paste & Continue ▸'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
