'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Recommendation {
  ticker: string
  stock_name: string
  sentiment: number
  target_price: number | null
  conviction_level: number
  catalyst_notes: string
  videos: {
    video_url: string
    youtube_video_id: string
    published_at: string
    channel_id: string
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
  if (sentiment >= 2) return 'text-[#00FFD0]'
  if (sentiment >= 1) return 'text-[#00D4AA]'
  if (sentiment <= -2) return 'text-[#FF1744]'
  if (sentiment <= -1) return 'text-[#FF4D6A]'
  return 'text-[#8B95A8]'
}

function getSentimentBadgeClass(sentiment: number): string {
  if (sentiment >= 2) return "sentiment-badge sentiment-badge-strong-buy"
  if (sentiment >= 1) return "sentiment-badge sentiment-badge-buy"
  if (sentiment <= -2) return "sentiment-badge sentiment-badge-strong-sell"
  if (sentiment <= -1) return "sentiment-badge sentiment-badge-sell"
  return "sentiment-badge sentiment-badge-neutral"
}

function SentimentArrow({ value }: { value: number }) {
  if (value >= 2) {
    return (
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="inline-block shrink-0">
        <path d="M7 2L7 12M7 2L3 6M7 2L11 6" stroke="#00FFD0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  if (value <= -2) {
    return (
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="inline-block shrink-0">
        <path d="M7 12L7 2M7 12L3 8M7 12L11 8" stroke="#FF1744" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  return null
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

function LazyYouTubeEmbed({ youtubeVideoId }: { youtubeVideoId: string }) {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-[#0A0F1A]">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}?autoplay=1&rel=0`}
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => setPlaying(true)}
        className="group/play relative shrink-0 rounded-md overflow-hidden w-24 h-14 bg-[#0A0F1A] border border-[#1E293B] hover:border-[#2D3A4F] transition-all duration-200 cursor-pointer"
        aria-label="Play video inline"
      >
        <img
          src={`https://i.ytimg.com/vi/${youtubeVideoId}/mqdefault.jpg`}
          alt=""
          className="w-full h-full object-cover opacity-70 group-hover/play:opacity-100 transition-opacity duration-200"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-7 h-7 rounded-full bg-[#0A0F1A]/80 flex items-center justify-center group-hover/play:scale-110 transition-all duration-200">
            <svg width="10" height="10" viewBox="0 0 16 18" fill="none" className="ml-0.5 text-[#F1F5F9] group-hover/play:text-[#00D4AA] transition-colors" aria-hidden="true">
              <path d="M1 1.5L15 9L1 16.5V1.5Z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </button>
      <a
        href={`https://www.youtube.com/watch?v=${youtubeVideoId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-[#64748B] hover:text-[#00D4AA] transition-colors"
      >
        YouTube ↗
      </a>
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
          stock_name,
          sentiment,
          target_price,
          conviction_level,
          catalyst_notes,
          videos!inner(
            video_url,
            youtube_video_id,
            published_at,
            channel_id,
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
          {/* Mini aura logo — nav home */}
          <Link
            href="/"
            className="inline-block text-xl font-extralight tracking-[0.2em] logo-sweep hover:opacity-80 transition-opacity"
          >
            <span className="logo-letter">aura</span>
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
        {/* Mini aura logo — nav home */}
        <Link
          href="/"
          className="inline-block text-xl font-extralight tracking-[0.2em] logo-sweep hover:opacity-80 transition-opacity animate-fade-up"
        >
          <span className="logo-letter">aura</span>
        </Link>

        {/* Ticker header */}
        <header className="mt-8 mb-10 animate-fade-up stagger-1">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="font-[family-name:var(--font-geist-mono)] text-5xl md:text-7xl font-bold tracking-tight text-[#F1F5F9]">
                {symbol.toUpperCase()}
              </h1>
              {recommendations[0]?.stock_name && (
                <p className="mt-1 text-lg text-[#8B95A8]">{recommendations[0].stock_name}</p>
              )}
              <p className="mt-2 text-sm text-[#64748B]">
                {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''} from YouTube analysts
              </p>
            </div>
            <a
              href={`https://finance.yahoo.com/quote/${symbol.toUpperCase()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group/yf inline-flex items-center gap-2 text-sm text-[#64748B] hover:text-[#F1F5F9] border border-[#1E293B] hover:border-[#2D3A4F] bg-[#141B2D]/60 hover:bg-[#141B2D] rounded-lg px-4 py-2 transition-all duration-200"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[#475569] group-hover/yf:text-[#00D4AA] transition-colors">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              <span className="font-[family-name:var(--font-geist-mono)] text-xs tracking-wide">Yahoo Finance</span>
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="opacity-0 group-hover/yf:opacity-100 transition-opacity duration-200 text-[#00D4AA]">
                <path d="M4 12L12 4M12 4H6M12 4V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>
        </header>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10 animate-fade-up stagger-2">
          <div className="rounded-xl border border-[#1E293B] bg-[#141B2D] p-4">
            <p className="text-xs text-[#64748B] mb-1">Avg Sentiment</p>
            <p className={`font-[family-name:var(--font-geist-mono)] text-2xl font-bold ${
              avgSentiment >= 1.5 ? 'sentiment-strong-buy' :
              avgSentiment >= 0.5 ? 'text-[#00D4AA]' :
              avgSentiment <= -1.5 ? 'sentiment-strong-sell' :
              avgSentiment <= -0.5 ? 'text-[#FF4D6A]' :
              'text-[#F1F5F9]'
            }`}>
              {avgSentiment.toFixed(1)}
            </p>
            <span className={getSentimentBadgeClass(Math.round(avgSentiment))}>
              <SentimentArrow value={avgSentiment} />
              {avgSentiment >= 1.5 ? 'Strong Buy' : avgSentiment >= 0.5 ? 'Buy' : avgSentiment > -0.5 ? 'Neutral' : avgSentiment > -1.5 ? 'Sell' : 'Strong Sell'}
            </span>
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
              {/* Top row: channel + date */}
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mb-4">
                <Link
                  href={`/channel?id=${rec.videos.channel_id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#F1F5F9] hover:text-[#00D4AA] transition-colors duration-200 group/channel"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#475569] group-hover/channel:text-[#00D4AA] transition-colors shrink-0" aria-hidden="true">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="group-hover/channel:underline decoration-[#00D4AA]/30 underline-offset-2">
                    {rec.videos.channels.channel_name}
                  </span>
                </Link>
                <span className="text-xs text-[#64748B]">
                  {formatDate(rec.videos.published_at)}
                </span>
              </div>

              {/* Lazy YouTube embed */}
              <div className="mb-4">
                <LazyYouTubeEmbed youtubeVideoId={rec.videos.youtube_video_id} />
              </div>

              {/* Stats row */}
              <div className="flex items-center flex-wrap gap-3 mb-3">
                <span className={getSentimentBadgeClass(rec.sentiment)}>
                  <SentimentArrow value={rec.sentiment} />
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
