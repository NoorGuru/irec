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
  const labels: Record<number, string> = {
    [-2]: "Strong Sell",
    [-1]: "Sell",
    0: "Neutral",
    1: "Buy",
    2: "Strong Buy",
  }
  return labels[sentiment] || "Unknown"
}

function getSentimentColor(sentiment: number): string {
  if (sentiment >= 1) return 'text-[#00D4AA]'
  if (sentiment <= -1) return 'text-[#FF4D6A]'
  return 'text-[#8B95A8]'
}

function ConvictionDots({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-0.5" title={`Conviction: ${level}/10`}>
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i < level ? 'bg-[#00D4AA]' : 'bg-[#1E293B]'
          }`}
        />
      ))}
    </div>
  )
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-4xl font-extralight tracking-[0.25em] logo-sweep">
            <span className="logo-letter">{symbol?.toUpperCase() || '...'}</span>
          </div>
          <p className="text-sm text-[#64748B]">Loading...</p>
        </div>
      </div>
    )
  }

  if (isInvalid || recommendations.length === 0) {
    return (
      <div className="min-h-screen px-4 py-8 md:px-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          {/* Mini Aura logo — nav home */}
          <Link
            href="/"
            className="inline-block text-xl font-extralight tracking-[0.2em] logo-sweep hover:opacity-80 transition-opacity"
          >
            <span className="logo-letter">Aura</span>
          </Link>

          <h1 className="mt-8 font-[family-name:var(--font-geist-mono)] text-5xl md:text-7xl font-bold tracking-tight text-[#F1F5F9]">
            {symbol?.toUpperCase() || '?'}
          </h1>
          <p className="mt-4 text-lg text-[#8B95A8]">No data available for this symbol.</p>
        </div>
      </div>
    )
  }

  // Compute aggregate stats for this ticker
  const avgSentiment = recommendations.reduce((s, r) => s + r.sentiment, 0) / recommendations.length
  const avgConviction = recommendations.reduce((s, r) => s + r.conviction_level, 0) / recommendations.length
  const prices = recommendations.filter(r => r.target_price !== null).map(r => r.target_price!)
  const avgPrice = prices.length > 0 ? prices.reduce((s, p) => s + p, 0) / prices.length : null

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        {/* Mini Aura logo — nav home */}
        <Link
          href="/"
          className="inline-block text-xl font-extralight tracking-[0.2em] logo-sweep hover:opacity-80 transition-opacity animate-fade-up"
        >
          <span className="logo-letter">Aura</span>
        </Link>

        {/* Ticker header */}
        <header className="mt-8 mb-10 animate-fade-up stagger-1">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="font-[family-name:var(--font-geist-mono)] text-5xl md:text-7xl font-bold tracking-tight text-[#F1F5F9]">
                {symbol.toUpperCase()}
              </h1>
              <p className="mt-2 text-sm text-[#8B95A8]">
                {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''} from YouTube analysts
              </p>
            </div>
            <a
              href={`https://finance.yahoo.com/quote/${symbol.toUpperCase()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#64748B] hover:text-[#00D4AA] border border-[#1E293B] rounded-lg px-3 py-1.5 transition-colors"
            >
              Yahoo Finance ↗
            </a>
          </div>
        </header>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10 animate-fade-up stagger-2">
          <div className="rounded-xl border border-[#1E293B] bg-[#141B2D] p-4">
            <p className="text-xs text-[#64748B] mb-1">Avg Sentiment</p>
            <p className={`font-[family-name:var(--font-geist-mono)] text-2xl font-bold ${
              avgSentiment >= 0.5 ? 'text-[#00D4AA]' :
              avgSentiment <= -0.5 ? 'text-[#FF4D6A]' :
              'text-[#F1F5F9]'
            }`}>
              {avgSentiment.toFixed(1)}
            </p>
            <p className={`text-xs font-medium mt-0.5 ${getSentimentColor(avgSentiment)}`}>
              {avgSentiment >= 1.5 ? 'Strong Buy' : avgSentiment >= 0.5 ? 'Buy' : avgSentiment > -0.5 ? 'Neutral' : avgSentiment > -1.5 ? 'Sell' : 'Strong Sell'}
            </p>
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#141B2D] p-4">
            <p className="text-xs text-[#64748B] mb-1">Avg Target</p>
            <p className="font-[family-name:var(--font-geist-mono)] text-2xl font-bold text-[#F1F5F9]">
              {avgPrice !== null ? `$${avgPrice.toFixed(0)}` : '—'}
            </p>
            {prices.length > 1 && (
              <p className="text-xs text-[#64748B] mt-0.5">
                ${Math.min(...prices).toFixed(0)} – ${Math.max(...prices).toFixed(0)}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#141B2D] p-4 col-span-2 md:col-span-1">
            <p className="text-xs text-[#64748B] mb-1">Avg Conviction</p>
            <p className="font-[family-name:var(--font-geist-mono)] text-2xl font-bold text-[#F1F5F9]">
              {avgConviction.toFixed(1)}<span className="text-sm text-[#64748B]">/10</span>
            </p>
            <div className="mt-1.5">
              <ConvictionDots level={Math.round(avgConviction)} />
            </div>
          </div>
        </div>

        {/* Recommendations list */}
        <div className="space-y-3">
          {recommendations.map((rec, index) => (
            <div
              key={index}
              className={`
                rounded-xl border border-[#1E293B] bg-[#141B2D]/60 p-5 md:p-6
                animate-fade-up stagger-${Math.min(index + 3, 10)}
              `}
            >
              {/* Top row: channel + date + video link */}
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mb-4">
                <span className="text-sm font-medium text-[#F1F5F9]">
                  {rec.videos.channels.channel_name}
                </span>
                <span className="text-xs text-[#64748B]">
                  {formatDate(rec.videos.published_at)}
                </span>
                <a
                  href={rec.videos.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-xs text-[#8B95A8] hover:text-[#00D4AA] transition-colors"
                >
                  Watch ↗
                </a>
              </div>

              {/* Stats row */}
              <div className="flex items-center flex-wrap gap-3 mb-3">
                <span className={`font-[family-name:var(--font-geist-mono)] text-sm font-bold ${getSentimentColor(rec.sentiment)}`}>
                  {getSentimentLabel(rec.sentiment)}
                </span>
                <span className="text-xs text-[#64748B]">
                  Target: {rec.target_price !== null ? (
                    <span className="font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">
                      ${rec.target_price.toFixed(2)}
                    </span>
                  ) : '—'}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[#64748B]">Conviction:</span>
                  <ConvictionDots level={rec.conviction_level} />
                </div>
              </div>

              {/* Catalyst notes */}
              {rec.catalyst_notes && (
                <p className="text-sm text-[#8B95A8] leading-relaxed">
                  {rec.catalyst_notes}
                </p>
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
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-[#64748B]">Loading...</p>
      </div>
    }>
      <TickerContent />
    </Suspense>
  )
}
