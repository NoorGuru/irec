import { useState, useRef, useEffect, useCallback } from 'react'
import { Zap, AlignLeft, Sparkles } from 'lucide-react'
import { YOUTUBE_URL_REGEX, extractVideoId, TRANSCRIPT_WORKER_URL } from './utils'
import { JobConfig } from './types'

function YoutubeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

export function UrlInputHero({

  onAddJob
}: {
  onAddJob: (job: JobConfig) => void
}) {
  const [url, setUrl] = useState('')
  const [manualTranscript, setManualTranscript] = useState('')
  const [validationError, setValidationError] = useState('')
  const [mode, setMode] = useState<'normal' | 'reextract' | 'force_reingest'>('normal')
  const [isManualMode, setIsManualMode] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const transcriptRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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

  const validateUrl = (value: string): boolean => {
    if (!value.trim()) {
      setValidationError('Enter a YouTube URL to extract.')
      return false
    }
    if (!YOUTUBE_URL_REGEX.test(value.trim())) {
      setValidationError('Supported formats: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/')
      return false
    }
    setValidationError('')
    return true
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!validateUrl(url)) return
    
    if (isManualMode && manualTranscript.trim().length < 20) {
      setValidationError('Please paste a valid transcript (at least 20 characters).')
      return
    }
    
    onAddJob({
      id: Math.random().toString(36).substring(2, 9),
      url: url.trim(),
      mode: isManualMode ? 'force_reingest' : mode,
      manualTranscriptText: isManualMode ? manualTranscript : undefined
    })
    
    setUrl('')
    setManualTranscript('')
    setIsManualMode(false)
  }

  const currentVideoId = extractVideoId(url)
  const targetWorkerUrl = currentVideoId ? `${TRANSCRIPT_WORKER_URL}/transcript?v=${currentVideoId}` : null

  return (
    <div className="space-y-6">
      <div className="animate-hero-rise">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-[#F1F5F9]">
          Ingest
        </h1>
        <p className="mt-3 text-base text-[#8B95A8]">
          Drop YouTube URLs. They will run concurrently.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 animate-fade-up stagger-2">
        
        {/* Toggle Mode */}
        <div className="flex bg-[#141B2D] border border-[#1E293B] rounded-xl p-1 inline-flex">
          <button
            type="button"
            onClick={() => {
              setIsManualMode(false)
              setTimeout(() => inputRef.current?.focus(), 50)
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${!isManualMode ? 'bg-[#0A0F1A] text-[#00D4AA] shadow' : 'text-[#8B95A8] hover:text-[#F1F5F9]'}`}
          >
            <Zap className="h-4 w-4" />
            Auto Extract
          </button>
          <button
            type="button"
            onClick={() => {
              setIsManualMode(true)
              setTimeout(() => transcriptRef.current?.focus(), 50)
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isManualMode ? 'bg-[#0A0F1A] text-[#00D4AA] shadow' : 'text-[#8B95A8] hover:text-[#F1F5F9]'}`}
          >
            <AlignLeft className="h-4 w-4" />
            Manual Paste
          </button>
        </div>

        <div className="relative flex gap-3">
          <div className="relative flex-1">
            <label htmlFor="youtube-url" className="sr-only">
              YouTube URL
            </label>
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <YoutubeIcon className={`h-5 w-5 ${url && YOUTUBE_URL_REGEX.test(url.trim()) ? 'text-[#FF0000]' : 'text-[#8B95A8]/40'}`} />
            </div>
            <input
              ref={inputRef}
              id="youtube-url"
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                if (validationError) setValidationError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSubmit()
                }
              }}
              maxLength={2048}
              placeholder="youtube.com/watch?v=..."
              className={`w-full rounded-xl border bg-[#141B2D] pl-12 pr-4 py-3.5 font-[family-name:var(--font-geist-mono)] text-sm text-[#F1F5F9] placeholder:text-[#8B95A8]/40 transition-all duration-200 focus:outline-none focus:ring-1 ${
                url && YOUTUBE_URL_REGEX.test(url.trim())
                  ? 'border-[#00D4AA]/60 focus:border-[#00D4AA] focus:ring-[#00D4AA]/30 shadow-[0_0_15px_rgba(0,212,170,0.1)]'
                  : 'border-[#1E293B] focus:border-[#00D4AA]/60 focus:ring-[#00D4AA]/30'
              }`}
              aria-describedby={validationError ? 'url-error' : undefined}
              aria-invalid={validationError ? true : undefined}
            />
            <div className="pointer-events-none absolute inset-0 rounded-xl border border-transparent opacity-0 peer-focus:opacity-100 transition-opacity" />
          </div>

          {!isManualMode && (
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
          )}
        </div>

        {isManualMode && (
          <div className="animate-fade-up rounded-xl border border-[#00D4AA]/20 bg-[#00D4AA]/[0.02] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#00D4AA]" />
                <h4 className="text-sm font-semibold text-[#F1F5F9]">Proactive Manual Paste</h4>
              </div>
              <a 
                href={targetWorkerUrl || '#'} 
                target={targetWorkerUrl ? "_blank" : undefined} 
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${targetWorkerUrl ? 'bg-[#00D4AA] text-[#0A0F1A] hover:bg-[#00FFD0]' : 'bg-[#1E293B] text-[#8B95A8]/40 pointer-events-none'}`}
              >
                Worker ↗
              </a>
            </div>
            <textarea 
              ref={transcriptRef}
              value={manualTranscript} 
              onChange={(e) => handleTranscriptChange(e.target.value)} 
              placeholder='Paste raw transcript JSON or text...' 
              rows={4} 
              className="w-full rounded-lg border border-[#1E293B] bg-[#0A0F1A] px-4 py-3 font-[family-name:var(--font-geist-mono)] text-sm text-[#F1F5F9] focus:outline-none focus:border-[#00D4AA]/50" 
            />
            <button 
              type="submit" 
              disabled={!url.trim() || manualTranscript.trim().length < 20} 
              className="w-full rounded-lg bg-[#00D4AA] px-4 py-3 text-sm font-semibold text-[#0A0F1A] hover:bg-[#00D4AA]/90 disabled:opacity-40 transition-colors"
            >
              Paste & Continue ▸
            </button>
          </div>
        )}

        {!isManualMode && (
          <div className="flex flex-wrap items-center gap-3">
            {(['normal', 'reextract', 'force_reingest'] as const).map((m) => (
              <label
                key={m}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  mode === m
                    ? 'border-[#00D4AA] bg-[#00D4AA]/10 text-[#00D4AA]'
                    : 'border-[#1E293B] bg-transparent text-[#8B95A8] hover:border-[#8B95A8]/50 hover:text-[#F1F5F9]'
                }`}
              >
                <input
                  type="radio"
                  name="ingest-mode"
                  value={m}
                  checked={mode === m}
                  onChange={() => setMode(m)}
                  className="sr-only"
                />
                <div className={`h-2.5 w-2.5 rounded-full border border-current ${mode === m ? 'bg-[#00D4AA]' : 'bg-transparent'}`} />
                {m === 'normal' ? 'Normal' : m === 'reextract' ? 'Re-extract (Fast)' : 'Force Re-ingest'}
              </label>
            ))}
          </div>
        )}

        {validationError && (
          <p id="url-error" className="text-sm text-[#FF4D6A] animate-fade-up" role="alert">
            {validationError}
          </p>
        )}
      </form>
    </div>
  )
}
