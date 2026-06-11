'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

const YOUTUBE_URL_REGEX =
  /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?.*v=|^(https?:\/\/)?youtu\.be\/|^(https?:\/\/)?(www\.)?youtube\.com\/shorts\//

interface Toast {
  id: number
  message: string
  type: 'success' | 'error'
}

export default function IngestPage() {
  const [url, setUrl] = useState('')
  const [validationError, setValidationError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    if (toasts.length === 0) return
    const latest = toasts[toasts.length - 1]
    const timer = setTimeout(() => {
      removeToast(latest.id)
    }, 5000)
    return () => clearTimeout(timer)
  }, [toasts, removeToast])

  const validateUrl = (value: string): boolean => {
    if (!value.trim()) {
      setValidationError('Please enter a YouTube URL.')
      return false
    }
    if (!YOUTUBE_URL_REGEX.test(value.trim())) {
      setValidationError(
        'Invalid URL format. Supported formats: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/'
      )
      return false
    }
    setValidationError('')
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateUrl(url)) return

    setIsLoading(true)
    setValidationError('')

    try {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        addToast('Session expired. Please log in again.', 'error')
        setIsLoading(false)
        return
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/extract`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ youtube_url: url.trim() }),
        }
      )

      if (response.status === 201) {
        const data = await response.json()
        const tickers = data.tickers_extracted?.join(', ') || 'none'
        setUrl('')
        addToast(`Extracted tickers: ${tickers}`, 'success')
      } else {
        const errorData = await response.json().catch(() => null)
        const errorMessage =
          errorData?.detail || errorData?.message || `Request failed with status ${response.status}`
        addToast(errorMessage, 'error')
      }
    } catch {
      addToast('Network error. Please check your connection and try again.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-semibold text-foreground">Ingestion Hub</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="youtube-url" className="mb-1.5 block text-sm font-medium text-foreground">
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
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-50"
              disabled={isLoading}
              aria-describedby={validationError ? 'url-error' : undefined}
              aria-invalid={validationError ? true : undefined}
            />
            {validationError && (
              <p id="url-error" className="mt-1.5 text-sm text-destructive" role="alert">
                {validationError}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Processing...
              </span>
            ) : (
              'Submit'
            )}
          </Button>
        </form>
      </div>

      {/* Toast notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-md px-4 py-3 text-sm shadow-lg transition-all ${
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-destructive text-white'
            }`}
            role="status"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  )
}
