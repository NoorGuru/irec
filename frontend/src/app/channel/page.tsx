'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

/* ─── Types ─── */

interface ChannelRow {
  channel_id: string
  channel_name: string
  trust_weight: number
  created_at: string
}

interface VideoRow {
  video_id: string
  video_url: string
  youtube_video_id: string
  published_at: string
}

interface RecommendationRow {
  id: string
  video_id: string
  ticker: string
  sentiment: number
  target_price: number | null
  conviction_level: number
  catalyst_notes: string
}

interface TickerBreakdown {
  ticker: string
  count: number
  avg_sentiment: number
  avg_conviction: number
  avg_target: number | null
  sentiments: number[]
}

interface VideoWithRecs {
  video_id: string
  video_url: string
  youtube_video_id: string
  published_at: string
  recommendations: RecommendationRow[]
}

/* ─── Helpers ─── */

function getSentimentWord(s: number): string {
  if (s >= 1.5) return 'Strong Buy'
  if (s >= 0.5) return 'Buy'
  if (s > -0.5) return 'Neutral'
  if (s > -1.5) return 'Sell'
  return 'Strong Sell'
}

function getSentimentColor(s: number): string {
  if (s >= 0.5) return 'text-[#00D4AA]'
  if (s <= -0.5) return 'text-[#FF4D6A]'
  return 'text-[#8B95A8]'
}

function getSentimentBg(s: number): string {
  if (s >= 0.5) return 'bg-[#00D4AA]'
  if (s <= -0.5) return 'bg-[#FF4D6A]'
  return 'bg-[#475569]'
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatShortDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getYoutubeThumbnail(youtubeVideoId: string): string {
  return `https://i.ytimg.com/vi/${youtubeVideoId}/mqdefault.jpg`
}

function getBiasLabel(avgSentiment: number, bullishPct: number): string {
  if (bullishPct >= 80) return 'Very Bullish'
  if (avgSentiment >= 0.5 || bullishPct >= 60) return 'Mostly Bullish'
  if (avgSentiment <= -0.5 || bullishPct <= 20) return 'Mostly Bearish'
  return 'Mixed'
}

/* ─── Components ─── */

function TickerHeatCell({ breakdown }: { breakdown: TickerBreakdown }) {
  return (
    <Link
      href={`/ticker?s=${breakdown.ticker}`}
      className="group/ticker relative rounded-xl border border-[#1E293B] bg-[#0A0F1A] p-4 hover:border-[#2D3A4F] hover:bg-[#141B2D]/40 transition-all duration-200"
    >
      {/* Ticker symbol */}
      <div className="flex items-start justify-between mb-3">
        <span className="font-[family-name:var(--font-geist-mono)] text-lg font-bold text-[#F1F5F9] tracking-wide group-hover/ticker:text-[#00D4AA] transition-colors">
          {breakdown.ticker}
        </span>
        <span className="text-[10px] text-[#475569]">
          {breakdown.count}×
        </span>
      </div>

      {/* Sentiment dots — one per recommendation, showing history */}
      <div className="flex items-center gap-1 mb-3">
        {breakdown.sentiments.map((s, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full ${getSentimentBg(s)}`}
            title={getSentimentWord(s)}
          />
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${getSentimentColor(breakdown.avg_sentiment)}`}>
          {getSentimentWord(breakdown.avg_sentiment)}
        </span>
        {breakdown.avg_target !== null && (
          <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[#64748B]">
            ${breakdown.avg_target.toFixed(0)}
          </span>
        )}
      </div>
    </Link>
  )
}

function VideoCard({ video, index }: { video: VideoWithRecs; index: number }) {
  const staggerClass = `stagger-${Math.min(index + 1, 10)}`
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`rounded-xl border border-[#1E293B] bg-[#141B2D]/40 overflow-hidden transition-all duration-300 animate-fade-up ${staggerClass} ${expanded ? 'bg-[#141B2D]' : ''}`}>
      {/* Collapsed row — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-4 md:p-5 text-left hover:bg-[#141B2D]/60 transition-colors duration-200 group/row"
      >
        {/* Thumbnail */}
        <div className="shrink-0 relative rounded-lg overflow-hidden w-20 h-12 md:w-28 md:h-16 bg-[#0A0F1A]">
          <img
            src={getYoutubeThumbnail(video.youtube_video_id)}
            alt=""
            className="w-full h-full object-cover opacity-70 group-hover/row:opacity-100 transition-opacity duration-200"
            loading="lazy"
          />
        </div>

        {/* Middle: date + ticker list */}
        <div className="flex-1 min-w-0">
          <span className="text-xs text-[#64748B] block mb-1">{formatDate(video.published_at)}</span>
          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
            {video.recommendations.map((rec) => (
              <span key={rec.id} className="font-[family-name:var(--font-geist-mono)] text-sm text-[#8B95A8]">
                {rec.ticker}
              </span>
            ))}
          </div>
        </div>

        {/* Right: sentiment dots + chevron */}
        <div className="shrink-0 flex items-center gap-3">
          <div className="flex items-center gap-1">
            {video.recommendations.map((rec) => (
              <div
                key={rec.id}
                className={`w-2 h-2 rounded-full ${getSentimentBg(rec.sentiment)}`}
                title={`${rec.ticker}: ${getSentimentWord(rec.sentiment)}`}
              />
            ))}
          </div>
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className={`text-[#475569] transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          >
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="px-4 pb-5 md:px-5 md:pb-6 pt-1 border-t border-[#1E293B]/60 space-y-3">
          {video.recommendations.map((rec) => (
            <div
              key={rec.id}
              className="flex items-start gap-3 rounded-lg bg-[#0A0F1A]/60 p-3 md:p-4"
            >
              {/* Sentiment indicator bar */}
              <div className={`w-1 self-stretch rounded-full shrink-0 ${getSentimentBg(rec.sentiment)}`} />

              <div className="flex-1 min-w-0">
                {/* Ticker + sentiment + target */}
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mb-1.5">
                  <Link
                    href={`/ticker?s=${rec.ticker}`}
                    className="font-[family-name:var(--font-geist-mono)] text-base font-bold text-[#F1F5F9] hover:text-[#00D4AA] transition-colors"
                  >
                    {rec.ticker}
                  </Link>
                  <span className={`text-xs font-medium ${getSentimentColor(rec.sentiment)}`}>
                    {getSentimentWord(rec.sentiment)}
                  </span>
                  {rec.target_price !== null && (
                    <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[#64748B]">
                      Target ${rec.target_price.toFixed(0)}
                    </span>
                  )}
                  <span className="text-[10px] text-[#475569]">
                    Conviction {rec.conviction_level}/10
                  </span>
                </div>

                {/* Catalyst notes */}
                {rec.catalyst_notes && (
                  <p className="text-xs text-[#64748B] leading-relaxed">
                    {rec.catalyst_notes}
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Link to video */}
          <a
            href={video.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[#475569] hover:text-[#00D4AA] transition-colors mt-2"
          >
            <svg width="12" height="12" viewBox="0 0 12 14" fill="none" aria-hidden="true">
              <path d="M1 1.5L11 7L1 12.5V1.5Z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
            </svg>
            Watch on YouTube
          </a>
        </div>
      )}
    </div>
  )
}

/* ─── Page Content ─── */

function ChannelContent() {
  const searchParams = useSearchParams()
  const channelId = searchParams.get('id') || ''

  const [channel, setChannel] = useState<ChannelRow | null>(null)
  const [videos, setVideos] = useState<VideoRow[]>([])
  const [recommendations, setRecommendations] = useState<RecommendationRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!channelId) {
      setLoading(false)
      return
    }

    async function fetchData() {
      const supabase = createClient()

      const [channelRes, videosRes] = await Promise.all([
        supabase.from('channels').select('*').eq('channel_id', channelId).single(),
        supabase.from('videos').select('video_id, video_url, youtube_video_id, published_at').eq('channel_id', channelId).order('published_at', { ascending: false }),
      ])

      if (!channelRes.data) {
        setLoading(false)
        return
      }

      setChannel(channelRes.data as ChannelRow)
      const vids = (videosRes.data || []) as VideoRow[]
      setVideos(vids)

      // Fetch recommendations for these videos
      if (vids.length > 0) {
        const videoIds = vids.map(v => v.video_id)
        const { data: recs } = await supabase
          .from('recommendations')
          .select('id, video_id, ticker, sentiment, target_price, conviction_level, catalyst_notes')
          .in('video_id', videoIds)

        setRecommendations((recs || []) as RecommendationRow[])
      }

      setLoading(false)
    }
    fetchData()
  }, [channelId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div className="absolute glow-emerge" style={{ width: '180px', height: '180px', animationDelay: '200ms' }}>
            <div className="aura-glow" />
          </div>
          <div className="relative">
            <div className="w-6 h-6 rounded-full border-2 border-[#1E293B] border-t-[#00D4AA] animate-spin" />
          </div>
        </div>
      </div>
    )
  }

  if (!channelId || !channel) {
    return (
      <div className="min-h-screen px-4 py-8 md:px-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          <Link href="/channels" className="inline-block text-xl font-extralight tracking-[0.2em] logo-sweep hover:opacity-80 transition-opacity">
            <span className="logo-letter">Aura</span>
          </Link>
          <h1 className="mt-12 text-4xl font-bold text-[#F1F5F9]">Channel not found</h1>
          <p className="mt-3 text-[#8B95A8]">This channel doesn&apos;t exist or has been removed.</p>
          <Link href="/channels" className="mt-6 inline-block text-sm text-[#00D4AA] hover:underline">
            ← Back to analysts
          </Link>
        </div>
      </div>
    )
  }

  // Compute derived data
  const allRecs = recommendations
  const bullishCount = allRecs.filter(r => r.sentiment >= 1).length
  const bearishCount = allRecs.filter(r => r.sentiment <= -1).length
  const totalRecs = allRecs.length || 1
  const bullishPct = (bullishCount / totalRecs) * 100
  const bearishPct = (bearishCount / totalRecs) * 100
  const avgSentiment = allRecs.length > 0
    ? allRecs.reduce((s, r) => s + r.sentiment, 0) / allRecs.length
    : 0
  const avgConviction = allRecs.length > 0
    ? allRecs.reduce((s, r) => s + r.conviction_level, 0) / allRecs.length
    : 0

  // Ticker breakdown
  const tickerMap = new Map<string, { sentiments: number[]; convictions: number[]; prices: number[] }>()
  for (const rec of allRecs) {
    if (!tickerMap.has(rec.ticker)) {
      tickerMap.set(rec.ticker, { sentiments: [], convictions: [], prices: [] })
    }
    const entry = tickerMap.get(rec.ticker)!
    entry.sentiments.push(rec.sentiment)
    entry.convictions.push(rec.conviction_level)
    if (rec.target_price !== null) entry.prices.push(rec.target_price)
  }

  const tickerBreakdowns: TickerBreakdown[] = [...tickerMap.entries()]
    .map(([ticker, data]) => ({
      ticker,
      count: data.sentiments.length,
      avg_sentiment: data.sentiments.reduce((a, b) => a + b, 0) / data.sentiments.length,
      avg_conviction: data.convictions.reduce((a, b) => a + b, 0) / data.convictions.length,
      avg_target: data.prices.length > 0 ? data.prices.reduce((a, b) => a + b, 0) / data.prices.length : null,
      sentiments: data.sentiments,
    }))
    .sort((a, b) => b.count - a.count)

  // Videos with their recommendations
  const videosWithRecs: VideoWithRecs[] = videos.map(v => ({
    ...v,
    recommendations: allRecs.filter(r => r.video_id === v.video_id),
  }))

  // Timeline: first and latest video dates
  const firstVideoDate = videos.length > 0 ? videos[videos.length - 1].published_at : null
  const latestVideoDate = videos.length > 0 ? videos[0].published_at : null

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 md:py-12">
      <div className="max-w-5xl mx-auto">
        {/* Nav breadcrumb */}
        <nav className="flex items-center gap-2 text-sm animate-fade-up">
          <Link href="/" className="text-xl font-extralight tracking-[0.2em] logo-sweep hover:opacity-80 transition-opacity">
            <span className="logo-letter">Aura</span>
          </Link>
          <span className="text-[#1E293B] mx-2">/</span>
          <Link href="/channels" className="text-[#64748B] hover:text-[#8B95A8] transition-colors">
            Analysts
          </Link>
        </nav>

        {/* ─── Hero: Channel Identity ─── */}
        <header className="mt-10 mb-12 animate-fade-up stagger-1">
          <h1 className="font-[family-name:var(--font-geist-mono)] text-4xl md:text-6xl font-bold tracking-tight text-[#F1F5F9]">
            {channel.channel_name}
          </h1>
          <div className="mt-3 flex items-center flex-wrap gap-x-4 gap-y-2 text-sm text-[#64748B]">
            <span>Tracking since {formatDate(channel.created_at)}</span>
            {firstVideoDate && latestVideoDate && firstVideoDate !== latestVideoDate && (
              <>
                <span className="text-[#1E293B]">·</span>
                <span>{formatShortDate(firstVideoDate)} → {formatShortDate(latestVideoDate)}</span>
              </>
            )}
            <span className="text-[#1E293B]">·</span>
            <span className="flex items-center gap-1.5">
              Trust
              <span className="font-[family-name:var(--font-geist-mono)] text-[#8B95A8]">{channel.trust_weight.toFixed(1)}×</span>
            </span>
          </div>
        </header>

        {/* ─── Stats Row ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12 animate-fade-up stagger-2">
          {/* Lean */}
          <div className="rounded-xl border border-[#1E293B] bg-[#141B2D] p-4 md:p-5">
            <span className="text-[10px] uppercase tracking-[0.15em] text-[#475569] block mb-2">Lean</span>
            <span className={`text-xl md:text-2xl font-semibold ${getSentimentColor(avgSentiment)}`}>
              {getBiasLabel(avgSentiment, bullishPct)}
            </span>
            <p className="font-[family-name:var(--font-geist-mono)] text-[11px] text-[#475569] mt-1">
              {Math.round(bullishPct)}% bullish · {Math.round(bearishPct)}% bearish
            </p>
          </div>

          {/* Total Calls */}
          <div className="rounded-xl border border-[#1E293B] bg-[#141B2D] p-4 md:p-5">
            <span className="text-[10px] uppercase tracking-[0.15em] text-[#475569] block mb-2">Total Calls</span>
            <span className="font-[family-name:var(--font-geist-mono)] text-3xl md:text-4xl font-bold text-[#F1F5F9]">
              {allRecs.length}
            </span>
            <p className="text-[11px] text-[#475569] mt-1">
              across {videos.length} video{videos.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Coverage */}
          <div className="rounded-xl border border-[#1E293B] bg-[#141B2D] p-4 md:p-5">
            <span className="text-[10px] uppercase tracking-[0.15em] text-[#475569] block mb-2">Coverage</span>
            <span className="font-[family-name:var(--font-geist-mono)] text-3xl md:text-4xl font-bold text-[#F1F5F9]">
              {tickerBreakdowns.length}
            </span>
            <p className="text-[11px] text-[#475569] mt-1">
              unique ticker{tickerBreakdowns.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Avg Conviction */}
          <div className="rounded-xl border border-[#1E293B] bg-[#141B2D] p-4 md:p-5">
            <span className="text-[10px] uppercase tracking-[0.15em] text-[#475569] block mb-2">Conviction</span>
            <span className="font-[family-name:var(--font-geist-mono)] text-3xl md:text-4xl font-bold text-[#F1F5F9]">
              {avgConviction.toFixed(1)}
            </span>
            <p className="text-[11px] text-[#475569] mt-1">
              avg out of 10
            </p>
          </div>
        </div>

        {/* ─── Ticker Coverage Grid ─── */}
        {tickerBreakdowns.length > 0 && (
          <section className="mb-14 animate-fade-up stagger-3">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="text-xl font-semibold text-[#F1F5F9]">Coverage</h2>
              <span className="text-xs text-[#475569]">
                Each dot = one call
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {tickerBreakdowns.map((b) => (
                <TickerHeatCell key={b.ticker} breakdown={b} />
              ))}
            </div>
          </section>
        )}

        {/* ─── Divider ─── */}
        <div className="relative h-px mb-12">
          <div className="absolute inset-0 bg-[#1E293B]" />
          <div className="absolute inset-0 h-px bg-gradient-to-r from-transparent via-[#00D4AA]/40 to-transparent" />
        </div>

        {/* ─── Video Timeline ─── */}
        {videosWithRecs.length > 0 && (
          <section className="animate-fade-up stagger-4">
            <div className="flex items-baseline justify-between mb-6">
              <h2 className="text-xl font-semibold text-[#F1F5F9]">Video History</h2>
              <span className="text-xs text-[#475569]">
                {videos.length} video{videos.length !== 1 ? 's' : ''} · newest first
              </span>
            </div>

            <div className="space-y-3">
              {videosWithRecs.map((video, index) => (
                <VideoCard key={video.video_id} video={video} index={index} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

/* ─── Page (Suspense boundary for useSearchParams) ─── */

export default function ChannelDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-[#1E293B] border-t-[#00D4AA] animate-spin" />
      </div>
    }>
      <ChannelContent />
    </Suspense>
  )
}
