'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Recommendation {
  ticker: string
  sentiment: number
  target_price: number | null
  conviction_level: number
  catalyst_notes: string
  videos: {
    video_url: string
    published_at: string
    channels: {
      channel_name: string
    }
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function getSentimentLabel(sentiment: number): string {
  const labels: Record<number, string> = { [-2]: "Strong Sell", [-1]: "Sell", 0: "Neutral", 1: "Buy", 2: "Strong Buy" }
  return labels[sentiment] || "Unknown"
}

function getSentimentColor(sentiment: number): string {
  const colors: Record<number, string> = {
    [-2]: "text-red-700 bg-red-100",
    [-1]: "text-red-600 bg-red-50",
    0: "text-gray-600 bg-gray-100",
    1: "text-green-600 bg-green-50",
    2: "text-green-700 bg-green-100",
  }
  return colors[sentiment] || "text-gray-600 bg-gray-100"
}

function TickerContent() {
  const searchParams = useSearchParams()
  const symbol = searchParams.get('s') || ''
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)

  const isInvalid = !symbol || symbol.length > 5 || /[^a-zA-Z]/.test(symbol)

  useEffect(() => {
    if (isInvalid) {
      setLoading(false)
      return
    }

    async function fetchData() {
      const supabase = createClient()
      const { data } = await supabase
        .from("recommendations")
        .select(`
          ticker,
          sentiment,
          target_price,
          conviction_level,
          catalyst_notes,
          videos!inner(
            video_url,
            published_at,
            channels!inner(channel_name)
          )
        `)
        .ilike("ticker", symbol)

      const sorted = ((data as unknown as Recommendation[]) || []).sort((a, b) => {
        return new Date(b.videos.published_at).getTime() - new Date(a.videos.published_at).getTime()
      })

      setRecommendations(sorted)
      setLoading(false)
    }
    fetchData()
  }, [symbol, isInvalid])

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    )
  }

  if (isInvalid || recommendations.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <Link href="/" className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
            ← Back to Dashboard
          </Link>
          <h1 className="mt-6 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {symbol?.toUpperCase() || 'Unknown'}
          </h1>
          <p className="mt-6 text-zinc-600 dark:text-zinc-400">No data available for this symbol.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link href="/" className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
          ← Back to Dashboard
        </Link>
        <h1 className="mt-6 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          {symbol.toUpperCase()}
          <a
            href={`https://finance.yahoo.com/quote/${symbol.toUpperCase()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-3 text-sm font-normal text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Yahoo Finance ↗
          </a>
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {recommendations.length} recommendation{recommendations.length !== 1 ? "s" : ""} found
        </p>

        <div className="mt-8 space-y-6">
          {recommendations.map((rec, index) => (
            <div key={index} className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {rec.videos.channels.channel_name}
                </span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {formatDate(rec.videos.published_at)}
                </span>
                <a href={rec.videos.video_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                  Watch Video ↗
                </a>
              </div>

              <div className="flex flex-wrap gap-3 mb-4">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getSentimentColor(rec.sentiment)}`}>
                  {getSentimentLabel(rec.sentiment)} ({rec.sentiment})
                </span>
                <span className="inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
                  Conviction: {rec.conviction_level}/10
                </span>
                <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  Target: {rec.target_price !== null ? `$${rec.target_price.toFixed(2)}` : "N/A"}
                </span>
              </div>

              {rec.catalyst_notes && (
                <p className="text-sm text-zinc-700 dark:text-zinc-300">{rec.catalyst_notes}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function TickerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-zinc-500">Loading...</p></div>}>
      <TickerContent />
    </Suspense>
  )
}
