'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

/* ─── Types ─── */

interface VideoRow {
  video_id: string
  video_url: string
  youtube_video_id: string
  published_at: string
  channel_id: string
  channels: {
    channel_name: string
    trust_weight: number
  }
}

interface RecommendationRow {
  id: string
  ticker: string
  stock_name: string
  sentiment: number
  target_price: number | null
  conviction_level: number
  catalyst_notes: string
}

/* ─── Helpers ─── */

function getSentimentLabel(s: number): string {
  if (s >= 2) return 'Strong Buy'
  if (s >= 1) return 'Buy'
  if (s === 0) return 'Neutral'
  if (s >= -1) return 'Sell'
  return 'Strong Sell'
}

function getSentimentBadgeClass(s: number): string {
  if (s >= 2) return 'sentiment-badge sentiment-badge-strong-buy'
  if (s >= 1) return 'sentiment-badge sentiment-badge-buy'
  if (s > -1) return 'sentiment-badge sentiment-badge-neutral'
  if (s > -2) return 'sentiment-badge sentiment-badge-sell'
  return 'sentiment-badge sentiment-badge-strong-sell'
}

function getSentimentColor(s: number): string {
  if (s >= 2) return 'text-[#00FFD0]'
  if (s >= 1) return 'text-[#00D4AA]'
  if (s <= -2) return 'text-[#FF1744]'
  if (s <= -1) return 'text-[#FF4D6A]'
  return 'text-[#8B95A8]'
}

function getSentimentBarColor(s: number): string {
  if (s >= 2) return 'bg-[#00FFD0]'
  if (s >= 1) return 'bg-[#00D4AA]'
  if (s <= -2) return 'bg-[#FF1744]'
  if (s <= -1) return 'bg-[#FF4D6A]'
  return 'bg-[#475569]'
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
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

/* ─── Components ─── */

function ConvictionBar({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-2" title={`Conviction: ${level}/10`}>
      <div className="flex gap-[3px]">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className={`w-[6px] h-4 rounded-sm transition-all duration-300 ${
              i < level ? 'bg-[#00D4AA]' : 'bg-[#1E293B]'
            }`}
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
      <span className="font-[family-name:var(--font-geist-mono)] text-sm text-[#8B95A8]">
        {level}<span className="text-[#475569]">/10</span>
      </span>
    </div>
  )
}

function TickerCard({ rec, index }: { rec: RecommendationRow; index: number }) {
  const staggerClass = `stagger-${Math.min(index + 3, 10)}`

  return (
    <div className={`group relative rounded-2xl border border-[#1E293B] bg-[#141B2D]/60 p-6 md:p-8 transition-all duration-300 hover:border-[#2D3A4F] hover:bg-[#141B2D] animate-fade-up ${staggerClass}`}>
      {/* Sentiment accent bar on the left */}
      <div className={`absolute left-0 top-6 bottom-6 w-1 rounded-full ${getSentimentBarColor(rec.sentiment)}`} />

      {/* Header: Ticker + Sentiment */}
      <div className="flex items-start justify-between gap-4 mb-5 pl-4">
        <div>
          <Link
            href={`/ticker?s=${rec.ticker}`}
            className="group/ticker inline-flex items-baseline gap-3"
          >
            <span className="font-[family-name:var(--font-geist-mono)] text-3xl md:text-4xl font-bold tracking-wide text-[#F1F5F9] group-hover/ticker:text-[#00D4AA] transition-colors duration-200">
              {rec.ticker}
            </span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-[#475569] group-hover/ticker:text-[#00D4AA] transition-all group-hover/ticker:translate-x-0.5 opacity-0 group-hover/ticker:opacity-100" aria-hidden="true">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          {rec.stock_name && (
            <p className="text-sm text-[#64748B] mt-1 pl-0.5">{rec.stock_name}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className={getSentimentBadgeClass(rec.sentiment)}>
            <SentimentArrow value={rec.sentiment} />
            {getSentimentLabel(rec.sentiment)}
          </span>
          {rec.target_price !== null && (
            <span className="font-[family-name:var(--font-geist-mono)] text-2xl font-semibold text-[#F1F5F9]">
              ${rec.target_price.toFixed(0)}
            </span>
          )}
        </div>
      </div>

      {/* Conviction */}
      <div className="pl-4 mb-5">
        <span className="text-[10px] uppercase tracking-[0.15em] text-[#475569] block mb-2">Conviction</span>
        <ConvictionBar level={rec.conviction_level} />
      </div>

      {/* Catalyst Notes */}
      {rec.catalyst_notes && (
        <div className="pl-4 pt-4 border-t border-[#1E293B]/60">
          <p className="text-sm text-[#8B95A8] leading-relaxed">
            {rec.catalyst_notes}
          </p>
        </div>
      )}
    </div>
  )
}

function VideoSummaryStats({ recommendations }: { recommendations: RecommendationRow[] }) {
  if (recommendations.length === 0) return null

  const avgSentiment = recommendations.reduce((s, r) => s + r.sentiment, 0) / recommendations.length
  const avgConviction = recommendations.reduce((s, r) => s + r.conviction_level, 0) / recommendations.length
  const targets = recommendations.filter(r => r.target_price !== null).map(r => r.target_price!)
  const bullish = recommendations.filter(r => r.sentiment >= 1).length
  const bearish = recommendations.filter(r => r.sentiment <= -1).length
  const neutral = recommendations.length - bullish - bearish

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-up stagger-2">
      {/* Overall Lean */}
      <div className="rounded-xl border border-[#1E293B] bg-[#141B2D] p-4 md:p-5">
        <span className="text-[10px] uppercase tracking-[0.15em] text-[#475569] block mb-2">Lean</span>
        <span className={`text-xl md:text-2xl font-semibold ${getSentimentColor(avgSentiment)}`}>
          {avgSentiment >= 1.5 ? 'Very Bullish' : avgSentiment >= 0.5 ? 'Bullish' : avgSentiment > -0.5 ? 'Mixed' : avgSentiment > -1.5 ? 'Bearish' : 'Very Bearish'}
        </span>
      </div>

      {/* Picks Count */}
      <div className="rounded-xl border border-[#1E293B] bg-[#141B2D] p-4 md:p-5">
        <span className="text-[10px] uppercase tracking-[0.15em] text-[#475569] block mb-2">Picks</span>
        <span className="font-[family-name:var(--font-geist-mono)] text-3xl md:text-4xl font-bold text-[#F1F5F9]">
          {recommendations.length}
        </span>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex h-1.5 rounded-full overflow-hidden bg-[#1E293B] flex-1">
            {bullish > 0 && <div className="h-full bg-[#00D4AA]" style={{ width: `${(bullish / recommendations.length) * 100}%` }} />}
            {neutral > 0 && <div className="h-full bg-[#475569]" style={{ width: `${(neutral / recommendations.length) * 100}%` }} />}
            {bearish > 0 && <div className="h-full bg-[#FF4D6A]" style={{ width: `${(bearish / recommendations.length) * 100}%` }} />}
          </div>
        </div>
      </div>

      {/* Avg Conviction */}
      <div className="rounded-xl border border-[#1E293B] bg-[#141B2D] p-4 md:p-5">
        <span className="text-[10px] uppercase tracking-[0.15em] text-[#475569] block mb-2">Conviction</span>
        <span className="font-[family-name:var(--font-geist-mono)] text-3xl md:text-4xl font-bold text-[#F1F5F9]">
          {avgConviction.toFixed(1)}
        </span>
        <p className="text-[11px] text-[#475569] mt-1">avg out of 10</p>
      </div>

      {/* Price Targets */}
      <div className="rounded-xl border border-[#1E293B] bg-[#141B2D] p-4 md:p-5">
        <span className="text-[10px] uppercase tracking-[0.15em] text-[#475569] block mb-2">Targets</span>
        {targets.length > 0 ? (
          <>
            <span className="font-[family-name:var(--font-geist-mono)] text-3xl md:text-4xl font-bold text-[#F1F5F9]">
              {targets.length}
            </span>
            <p className="text-[11px] text-[#475569] mt-1">
              ${Math.min(...targets).toFixed(0)} – ${Math.max(...targets).toFixed(0)}
            </p>
          </>
        ) : (
          <span className="text-2xl text-[#475569]">—</span>
        )}
      </div>
    </div>
  )
}

/* ─── Main Content ─── */

function VideoContent() {
  const searchParams = useSearchParams()
  const videoId = searchParams.get('id') || ''

  const [video, setVideo] = useState<VideoRow | null>(null)
  const [recommendations, setRecommendations] = useState<RecommendationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [playerActive, setPlayerActive] = useState(false)

  useEffect(() => {
    if (!videoId) {
      setLoading(false)
      return
    }

    async function fetchData() {
      const supabase = createClient()

      // Fetch video with channel info
      const { data: videoData } = await supabase
        .from('videos')
        .select(`
          video_id,
          video_url,
          youtube_video_id,
          published_at,
          channel_id,
          channels!inner(channel_name, trust_weight)
        `)
        .eq('youtube_video_id', videoId)
        .single()

      if (!videoData) {
        setLoading(false)
        return
      }

      setVideo(videoData as unknown as VideoRow)

      // Fetch recommendations for this video
      const { data: recsData } = await supabase
        .from('recommendations')
        .select('id, ticker, stock_name, sentiment, target_price, conviction_level, catalyst_notes')
        .eq('video_id', (videoData as { video_id: string }).video_id)

      setRecommendations((recsData as unknown as RecommendationRow[]) || [])
      setLoading(false)
    }
    fetchData()
  }, [videoId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div className="absolute glow-emerge" style={{ width: '200px', height: '200px', animationDelay: '200ms' }}>
            <div className="aura-glow" />
          </div>
          <div className="relative text-center space-y-3">
            <div className="w-6 h-6 mx-auto rounded-full border-2 border-[#1E293B] border-t-[#00D4AA] animate-spin" />
            <p className="text-xs text-[#64748B]">Loading video...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!videoId || !video) {
    return (
      <div className="min-h-screen px-4 py-8 md:px-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          <Link href="/" className="inline-block text-xl font-extralight tracking-[0.2em] logo-sweep hover:opacity-80 transition-opacity">
            <span className="logo-letter">aura</span>
          </Link>
          <h1 className="mt-12 text-4xl font-bold text-[#F1F5F9]">Video not found</h1>
          <p className="mt-3 text-[#8B95A8]">This video hasn&apos;t been analyzed yet, or the link is incorrect.</p>
          <Link href="/" className="mt-6 inline-block text-sm text-[#00D4AA] hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  // Sort recommendations: highest conviction first, then sentiment
  const sortedRecs = [...recommendations].sort((a, b) => {
    if (b.conviction_level !== a.conviction_level) return b.conviction_level - a.conviction_level
    return b.sentiment - a.sentiment
  })

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        {/* ─── Nav ─── */}
        <nav className="flex items-center gap-2 text-sm animate-fade-up">
          <Link href="/" className="text-xl font-extralight tracking-[0.2em] logo-sweep hover:opacity-80 transition-opacity">
            <span className="logo-letter">aura</span>
          </Link>
          <span className="text-[#1E293B] mx-2">/</span>
          <Link href={`/channel?id=${video.channel_id}`} className="text-[#64748B] hover:text-[#8B95A8] transition-colors truncate max-w-[200px]">
            {video.channels.channel_name}
          </Link>
        </nav>

        {/* ─── Video Hero ─── */}
        <header className="mt-10 mb-8 animate-fade-up stagger-1">
          {/* YouTube Embed / Thumbnail */}
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-[#0A0F1A] border border-[#1E293B] mb-8">
            {playerActive ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${video.youtube_video_id}?autoplay=1&rel=0`}
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            ) : (
              <button
                onClick={() => setPlayerActive(true)}
                className="group/play absolute inset-0 w-full h-full cursor-pointer"
                aria-label="Play video"
              >
                <img
                  src={`https://i.ytimg.com/vi/${video.youtube_video_id}/maxresdefault.jpg`}
                  alt=""
                  className="w-full h-full object-cover opacity-70 group-hover/play:opacity-90 transition-opacity duration-300"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0F1A] via-transparent to-transparent opacity-80" />
                {/* Play button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-[#0A0F1A]/70 border border-[#2D3A4F] backdrop-blur-sm flex items-center justify-center group-hover/play:bg-[#0A0F1A]/90 group-hover/play:border-[#00D4AA]/50 group-hover/play:scale-110 transition-all duration-300">
                    <svg width="28" height="28" viewBox="0 0 16 18" fill="none" className="ml-1 text-[#F1F5F9] group-hover/play:text-[#00D4AA] transition-colors" aria-hidden="true">
                      <path d="M1 1.5L15 9L1 16.5V1.5Z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </button>
            )}
          </div>

          {/* Video meta */}
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Link
                  href={`/channel?id=${video.channel_id}`}
                  className="group/ch inline-flex items-center gap-2 text-base font-medium text-[#F1F5F9] hover:text-[#00D4AA] transition-colors duration-200"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-[#475569] group-hover/ch:text-[#00D4AA] transition-colors shrink-0" aria-hidden="true">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  <span className="group-hover/ch:underline decoration-[#00D4AA]/30 underline-offset-2">
                    {video.channels.channel_name}
                  </span>
                </Link>
                <span className="text-[#1E293B]" aria-hidden="true">·</span>
                <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[#64748B]">
                  Trust {video.channels.trust_weight.toFixed(1)}×
                </span>
              </div>
              <p className="text-sm text-[#64748B]">
                Published {formatDate(video.published_at)}
              </p>
            </div>

            <a
              href={video.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group/yt inline-flex items-center gap-2 text-sm text-[#64748B] hover:text-[#F1F5F9] border border-[#1E293B] hover:border-[#2D3A4F] bg-[#141B2D]/60 hover:bg-[#141B2D] rounded-lg px-4 py-2.5 transition-all duration-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-[#FF0000]/70 group-hover/yt:text-[#FF0000]">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <span className="font-[family-name:var(--font-geist-mono)] text-xs tracking-wide">Watch on YouTube</span>
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="opacity-0 group-hover/yt:opacity-100 transition-opacity duration-200 text-[#00D4AA]">
                <path d="M4 12L12 4M12 4H6M12 4V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>
        </header>

        {/* ─── Summary Stats ─── */}
        <section className="mb-10">
          <VideoSummaryStats recommendations={recommendations} />
        </section>

        {/* ─── Divider ─── */}
        <div className="relative h-px mb-10 animate-fade-up stagger-2">
          <div className="absolute inset-0 bg-[#1E293B]" />
          <div className="absolute inset-0 h-px bg-gradient-to-r from-transparent via-[#00D4AA]/30 to-transparent" />
        </div>

        {/* ─── Section Header ─── */}
        <div className="flex items-baseline justify-between mb-6 animate-fade-up stagger-2">
          <h2 className="text-2xl md:text-3xl font-semibold text-[#F1F5F9]">
            Picks from this video
          </h2>
          <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[#475569]">
            sorted by conviction
          </span>
        </div>

        {/* ─── Recommendation Cards ─── */}
        {sortedRecs.length === 0 ? (
          <div className="rounded-xl border border-[#1E293B] bg-[#141B2D]/40 p-12 text-center animate-fade-up">
            <p className="text-lg text-[#8B95A8]">No picks extracted.</p>
            <p className="mt-2 text-sm text-[#64748B]">
              This video was processed but no stock recommendations were found.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedRecs.map((rec, index) => (
              <TickerCard key={rec.id} rec={rec} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Page Export ─── */

export default function VideoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-[#1E293B] border-t-[#00D4AA] animate-spin" />
      </div>
    }>
      <VideoContent />
    </Suspense>
  )
}
