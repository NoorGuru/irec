'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

/* ─── Types ─── */

interface VideoRow {
  video_id: string
  video_url: string
  youtube_video_id: string
  published_at: string
  extracted_at: string
  video_summary: string | null
  title: string | null
  duration: string | null
  channel_id: string
  channels: {
    channel_name: string
    trust_weight: number
  }
}

interface RecommendationRow {
  id: string
  video_id: string
  ticker: string
  stock_name: string
  sentiment: number
  target_price: number | null
  conviction_level: number
}

type SortKey = 'newest' | 'oldest' | 'most-picks' | 'highest-conviction'
type SentimentFilter = '' | 'bullish' | 'bearish' | 'mixed'

/* ─── Helpers ─── */

function getSentimentLabel(s: number): string {
  if (s >= 1.5) return 'Strong Buy'
  if (s >= 0.5) return 'Buy'
  if (s > -0.5) return 'Neutral'
  if (s > -1.5) return 'Sell'
  return 'Strong Sell'
}

function getSentimentBadgeClass(s: number): string {
  if (s >= 1.5) return 'sentiment-badge sentiment-badge-strong-buy'
  if (s >= 0.5) return 'sentiment-badge sentiment-badge-buy'
  if (s > -0.5) return 'sentiment-badge sentiment-badge-neutral'
  if (s > -1.5) return 'sentiment-badge sentiment-badge-sell'
  return 'sentiment-badge sentiment-badge-strong-sell'
}

function getSentimentBg(s: number): string {
  if (s >= 1.5) return 'bg-[#00FFD0]'
  if (s >= 0.5) return 'bg-[#00D4AA]'
  if (s <= -1.5) return 'bg-[#FF1744]'
  if (s <= -0.5) return 'bg-[#FF4D6A]'
  return 'bg-[#475569]'
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDuration(iso: string | null): string | null {
  if (!iso) return null
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return null
  const h = match[1] ? parseInt(match[1]) : 0
  const m = match[2] ? parseInt(match[2]) : 0
  const s = match[3] ? parseInt(match[3]) : 0
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '—'
  const diff = Date.now() - date.getTime()
  if (diff < 0) return '—'
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return '1d ago'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function TimeAgo({ dateStr }: { dateStr: string }) {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    setText(timeAgo(dateStr))
  }, [dateStr])
  if (text === null) return null
  return <>{text}</>
}

/* ─── Enriched video type ─── */

interface EnrichedVideo {
  video_id: string
  video_url: string
  youtube_video_id: string
  published_at: string
  extracted_at: string
  video_summary: string | null
  title: string | null
  duration: string | null
  channel_id: string
  channel_name: string
  trust_weight: number
  recommendations: RecommendationRow[]
  avg_sentiment: number
  avg_conviction: number
  pick_count: number
}

function enrichVideos(
  videos: VideoRow[],
  recommendations: RecommendationRow[]
): EnrichedVideo[] {
  const recsByVideo = new Map<string, RecommendationRow[]>()
  for (const rec of recommendations) {
    const list = recsByVideo.get(rec.video_id) || []
    list.push(rec)
    recsByVideo.set(rec.video_id, list)
  }

  return videos.map((v) => {
    const recs = recsByVideo.get(v.video_id) || []
    const avgSentiment =
      recs.length > 0
        ? recs.reduce((s, r) => s + r.sentiment, 0) / recs.length
        : 0
    const avgConviction =
      recs.length > 0
        ? recs.reduce((s, r) => s + r.conviction_level, 0) / recs.length
        : 0

    return {
      video_id: v.video_id,
      video_url: v.video_url,
      youtube_video_id: v.youtube_video_id,
      published_at: v.published_at,
      extracted_at: v.extracted_at,
      video_summary: v.video_summary,
      title: v.title,
      duration: v.duration,
      channel_id: v.channel_id,
      channel_name: v.channels.channel_name,
      trust_weight: v.channels.trust_weight,
      recommendations: recs,
      avg_sentiment: avgSentiment,
      avg_conviction: avgConviction,
      pick_count: recs.length,
    }
  })
}

/* ─── Aggregate Stats ─── */

function AggregateStats({ videos }: { videos: EnrichedVideo[] }) {
  const totalPicks = videos.reduce((s, v) => s + v.pick_count, 0)
  const totalChannels = new Set(videos.map((v) => v.channel_id)).size
  const avgPicksPerVideo =
    videos.length > 0 ? totalPicks / videos.length : 0

  // Activity: videos ingested in last 7 days
  const [recentCount, setRecentCount] = useState(0)
  useEffect(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    setRecentCount(
      videos.filter((v) => new Date(v.extracted_at).getTime() > weekAgo).length
    )
  }, [videos])

  if (videos.length === 0) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-up stagger-2">
      <div className="rounded-xl border border-[#1E293B] bg-[#141B2D] p-4 md:p-5">
        <span className="text-[10px] uppercase tracking-[0.15em] text-[#475569] block mb-2">
          Videos
        </span>
        <span className="font-[family-name:var(--font-geist-mono)] text-3xl md:text-4xl font-bold text-[#F1F5F9]">
          {videos.length}
        </span>
        <p className="text-[11px] text-[#475569] mt-1">total analyzed</p>
      </div>

      <div className="rounded-xl border border-[#1E293B] bg-[#141B2D] p-4 md:p-5">
        <span className="text-[10px] uppercase tracking-[0.15em] text-[#475569] block mb-2">
          Picks Extracted
        </span>
        <span className="font-[family-name:var(--font-geist-mono)] text-3xl md:text-4xl font-bold text-[#F1F5F9]">
          {totalPicks}
        </span>
        <p className="text-[11px] text-[#475569] mt-1">
          ~{avgPicksPerVideo.toFixed(1)} per video
        </p>
      </div>

      <div className="rounded-xl border border-[#1E293B] bg-[#141B2D] p-4 md:p-5">
        <span className="text-[10px] uppercase tracking-[0.15em] text-[#475569] block mb-2">
          Channels
        </span>
        <span className="font-[family-name:var(--font-geist-mono)] text-3xl md:text-4xl font-bold text-[#F1F5F9]">
          {totalChannels}
        </span>
        <p className="text-[11px] text-[#475569] mt-1">unique analysts</p>
      </div>

      <div className="rounded-xl border border-[#1E293B] bg-[#141B2D] p-4 md:p-5">
        <span className="text-[10px] uppercase tracking-[0.15em] text-[#475569] block mb-2">
          This Week
        </span>
        <span className="font-[family-name:var(--font-geist-mono)] text-3xl md:text-4xl font-bold text-[#00D4AA]">
          {recentCount}
        </span>
        <p className="text-[11px] text-[#475569] mt-1">new ingestions</p>
      </div>
    </div>
  )
}

/* ─── Sort/Filter Controls ─── */

function VideoFilters({
  sort,
  setSort,
  sentimentFilter,
  setSentimentFilter,
  channelFilter,
  setChannelFilter,
  channels,
  search,
  setSearch,
}: {
  sort: SortKey
  setSort: (s: SortKey) => void
  sentimentFilter: SentimentFilter
  setSentimentFilter: (f: SentimentFilter) => void
  channelFilter: string
  setChannelFilter: (c: string) => void
  channels: string[]
  search: string
  setSearch: (s: string) => void
}) {
  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'newest', label: 'Newest' },
    { key: 'oldest', label: 'Oldest' },
    { key: 'most-picks', label: 'Most Picks' },
    { key: 'highest-conviction', label: 'Conviction' },
  ]

  const sentimentOptions: { key: SentimentFilter; label: string }[] = [
    { key: '', label: 'All' },
    { key: 'bullish', label: 'Bullish' },
    { key: 'mixed', label: 'Mixed' },
    { key: 'bearish', label: 'Bearish' },
  ]

  return (
    <div className="space-y-4 animate-fade-up stagger-3">
      {/* Search */}
      <div className="relative">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]"
        >
          <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
          <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by ticker or channel…"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#0A0F1A] border border-[#1E293B] text-sm text-[#F1F5F9] placeholder:text-[#475569] focus:outline-none focus:border-[#00D4AA]/40 transition-colors"
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.15em] text-[#475569]">Sort</span>
          <div className="flex gap-1">
            {sortOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSort(opt.key)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                  sort === opt.key
                    ? 'bg-[#00D4AA]/10 text-[#00D4AA] border border-[#00D4AA]/30'
                    : 'text-[#64748B] hover:text-[#8B95A8] border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sentiment filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.15em] text-[#475569]">Lean</span>
          <div className="flex gap-1">
            {sentimentOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSentimentFilter(opt.key)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                  sentimentFilter === opt.key
                    ? 'bg-[#00D4AA]/10 text-[#00D4AA] border border-[#00D4AA]/30'
                    : 'text-[#64748B] hover:text-[#8B95A8] border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Channel filter */}
        {channels.length > 1 && (
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[#0A0F1A] border border-[#1E293B] text-xs text-[#8B95A8] focus:outline-none focus:border-[#00D4AA]/40 transition-colors cursor-pointer"
          >
            <option value="">All channels</option>
            {channels.map((ch) => (
              <option key={ch} value={ch}>
                {ch}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}

/* ─── Video Card ─── */

function VideoCard({ video, index }: { video: EnrichedVideo; index: number }) {
  const staggerClass = `stagger-${Math.min(index + 1, 10)}`
  const hasManyPicks = video.pick_count >= 5

  return (
    <Link
      href={`/video?id=${video.youtube_video_id}`}
      className={`
        group block rounded-2xl border overflow-hidden transition-all duration-300
        ${hasManyPicks
          ? 'border-[#00D4AA]/20 bg-[#141B2D]/70 hover:border-[#00D4AA]/40'
          : 'border-[#1E293B] bg-[#141B2D]/40 hover:border-[#2D3A4F] hover:bg-[#141B2D]'
        }
        animate-fade-up ${staggerClass}
      `}
    >
      <div className="flex flex-col md:flex-row">
        {/* Thumbnail */}
        <div className="relative shrink-0 w-full md:w-64 lg:w-72 aspect-video md:aspect-auto md:h-auto overflow-hidden bg-[#0A0F1A]">
          <img
            src={`https://i.ytimg.com/vi/${video.youtube_video_id}/mqdefault.jpg`}
            alt=""
            className="w-full h-full object-cover opacity-60 group-hover:opacity-90 transition-opacity duration-300"
            loading="lazy"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#141B2D] hidden md:block" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#141B2D] via-transparent to-transparent md:hidden" />

          {/* Play indicator */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-12 h-12 rounded-full bg-[#0A0F1A]/80 border border-[#2D3A4F] backdrop-blur-sm flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 18" fill="none" className="ml-0.5 text-[#00D4AA]">
                <path d="M1 1.5L15 9L1 16.5V1.5Z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          {/* Pick count badge */}
          <div className="absolute top-3 left-3 md:bottom-3 md:top-auto">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#0A0F1A]/90 border border-[#1E293B] backdrop-blur-sm text-[10px] font-[family-name:var(--font-geist-mono)] text-[#8B95A8]">
              {video.pick_count} pick{video.pick_count !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Duration badge */}
          {formatDuration(video.duration) && (
            <div className="absolute bottom-3 right-3">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#0A0F1A]/90 text-[10px] font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">
                {formatDuration(video.duration)}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-5 md:p-6 flex flex-col justify-between min-w-0">
          {/* Top section */}
          <div>
            {/* Title */}
            {video.title && (
              <h3 className="text-base md:text-lg font-semibold text-[#F1F5F9] group-hover:text-[#00D4AA] transition-colors leading-snug mb-2 line-clamp-2">
                {video.title}
              </h3>
            )}

            {/* Channel + time */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-medium text-[#8B95A8] truncate max-w-[200px]">
                {video.channel_name}
              </span>
              <span className="text-[#1E293B]" aria-hidden="true">·</span>
              <span className="font-[family-name:var(--font-geist-mono)] text-[11px] text-[#475569]">
                {formatDate(video.published_at)}
              </span>
              <span className="text-[#1E293B]" aria-hidden="true">·</span>
              <span className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[#374151]">
                ingested <TimeAgo dateStr={video.extracted_at} />
              </span>
            </div>

            {/* Summary if available */}
            {video.video_summary && (
              <p className="text-sm text-[#8B95A8] leading-relaxed line-clamp-2 mb-3">
                {video.video_summary}
              </p>
            )}

            {/* Ticker pills */}
            <div className="flex items-center flex-wrap gap-1.5">
              {video.recommendations.slice(0, 8).map((rec) => (
                <span
                  key={rec.id}
                  className="inline-flex items-center gap-1 font-[family-name:var(--font-geist-mono)] text-xs px-2 py-0.5 rounded-md bg-[#0A0F1A] border border-[#1E293B] text-[#8B95A8]"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${getSentimentBg(rec.sentiment)}`}
                  />
                  {rec.ticker}
                </span>
              ))}
              {video.recommendations.length > 8 && (
                <span className="text-[10px] text-[#475569]">
                  +{video.recommendations.length - 8} more
                </span>
              )}
            </div>
          </div>

          {/* Bottom: stats row */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#1E293B]/40">
            {/* Sentiment summary */}
            <div className="flex items-center gap-3">
              {video.pick_count > 0 && (
                <span className={getSentimentBadgeClass(video.avg_sentiment)}>
                  {getSentimentLabel(video.avg_sentiment)}
                </span>
              )}
              <span className="font-[family-name:var(--font-geist-mono)] text-[11px] text-[#475569]">
                Conv {video.avg_conviction.toFixed(1)}/10
              </span>
            </div>

            {/* Arrow */}
            <div className="text-[#475569] group-hover:text-[#00D4AA] transition-colors">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="transform group-hover:translate-x-0.5 transition-transform"
              >
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}



/* ─── Main Page ─── */

export default function VideosPage() {
  const [videos, setVideos] = useState<EnrichedVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortKey>('newest')
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('')
  const [channelFilter, setChannelFilter] = useState('')
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(12)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()

      const [videosRes, recsRes] = await Promise.all([
        supabase
          .from('videos')
          .select(`
            video_id,
            video_url,
            youtube_video_id,
            published_at,
            extracted_at,
            video_summary,
            title,
            duration,
            channel_id,
            channels!inner(channel_name, trust_weight)
          `)
          .order('published_at', { ascending: false }),
        supabase
          .from('recommendations')
          .select('id, video_id, ticker, stock_name, sentiment, target_price, conviction_level'),
      ])

      const vids = (videosRes.data || []) as unknown as VideoRow[]
      const recs = (recsRes.data || []) as unknown as RecommendationRow[]

      setVideos(enrichVideos(vids, recs))
      setLoading(false)
    }
    fetchData()
  }, [])

  // Derive unique channel names for filter dropdown
  const channelNames = useMemo(() => {
    const names = [...new Set(videos.map((v) => v.channel_name))]
    return names.sort()
  }, [videos])

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(12)
  }, [search, sentimentFilter, channelFilter, sort])

  // Sort and filter
  const processed = useMemo(() => {
    let list = [...videos]

    // Search
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (v) =>
          v.channel_name.toLowerCase().includes(q) ||
          v.recommendations.some((r) => r.ticker.toLowerCase().includes(q)) ||
          (v.video_summary && v.video_summary.toLowerCase().includes(q)) ||
          (v.title && v.title.toLowerCase().includes(q))
      )
    }

    // Sentiment filter
    if (sentimentFilter === 'bullish') {
      list = list.filter((v) => v.avg_sentiment >= 0.5)
    } else if (sentimentFilter === 'bearish') {
      list = list.filter((v) => v.avg_sentiment <= -0.5)
    } else if (sentimentFilter === 'mixed') {
      list = list.filter(
        (v) => v.avg_sentiment > -0.5 && v.avg_sentiment < 0.5
      )
    }

    // Channel filter
    if (channelFilter) {
      list = list.filter((v) => v.channel_name === channelFilter)
    }

    // Sort
    switch (sort) {
      case 'newest':
        list.sort(
          (a, b) =>
            new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
        )
        break
      case 'oldest':
        list.sort(
          (a, b) =>
            new Date(a.published_at).getTime() - new Date(b.published_at).getTime()
        )
        break
      case 'most-picks':
        list.sort((a, b) => b.pick_count - a.pick_count)
        break
      case 'highest-conviction':
        list.sort((a, b) => b.avg_conviction - a.avg_conviction)
        break
    }

    return list
  }, [videos, search, sentimentFilter, channelFilter, sort])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div className="absolute glow-emerge" style={{ width: '200px', height: '200px', animationDelay: '300ms' }}>
            <div className="aura-glow" />
          </div>
          <div className="relative text-center">
            <div className="text-5xl font-extralight tracking-[0.2em] logo-sweep">
              {'Videos'.split('').map((letter, i) => (
                <span
                  key={i}
                  className="logo-letter letter-materialize"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {letter}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-[#64748B] byline-appear" style={{ animationDelay: '600ms' }}>
              Loading the archive…
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 md:py-12">
      <div className="max-w-5xl mx-auto">
        {/* Page header */}
        <header className="mt-12 mb-4 animate-fade-up stagger-1">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-[#F1F5F9]">
            The Archive
          </h1>
          <p className="mt-3 text-lg text-[#8B95A8] font-light max-w-lg">
            Every video analyzed by aura. Each one dissected for stock picks, sentiment, and conviction.
          </p>
        </header>

        {/* Stats */}
        <section className="mb-8">
          <AggregateStats videos={videos} />
        </section>

        {/* Pulse line separator */}
        <div className="relative h-px mb-8 animate-fade-up stagger-3">
          <div className="absolute inset-0 bg-[#1E293B]" />
          <div className="absolute inset-0 h-px bg-gradient-to-r from-transparent via-[#00D4AA] to-transparent hero-pulse-line" />
        </div>

        {/* Filters */}
        <section className="mb-8">
          <VideoFilters
            sort={sort}
            setSort={setSort}
            sentimentFilter={sentimentFilter}
            setSentimentFilter={setSentimentFilter}
            channelFilter={channelFilter}
            setChannelFilter={setChannelFilter}
            channels={channelNames}
            search={search}
            setSearch={setSearch}
          />
        </section>

        {/* Results count */}
        <div className="flex items-center justify-between mb-6 animate-fade-up stagger-4">
          <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[#64748B]">
            {processed.length} video{processed.length !== 1 ? 's' : ''}
            {search || sentimentFilter || channelFilter ? ' matching' : ''}
          </span>
        </div>

        {/* Video list */}
        {processed.length === 0 ? (
          <div className="rounded-xl border border-[#1E293B] bg-[#141B2D]/40 p-12 text-center animate-fade-up">
            <p className="text-lg text-[#8B95A8]">No videos found.</p>
            <p className="mt-2 text-sm text-[#64748B]">
              {search || sentimentFilter || channelFilter
                ? 'Try adjusting your filters.'
                : 'Videos appear once they are ingested by an admin.'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {processed.slice(0, visibleCount).map((video, index) => (
                <VideoCard key={video.video_id} video={video} index={index} />
              ))}
            </div>

            {visibleCount < processed.length && (
              <div className="mt-8 text-center animate-fade-up">
                <button
                  onClick={() => setVisibleCount((c) => c + 12)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[#1E293B] bg-[#141B2D]/60 text-sm font-medium text-[#8B95A8] hover:text-[#00D4AA] hover:border-[#00D4AA]/30 hover:bg-[#141B2D] transition-all duration-200"
                >
                  <span>Load more</span>
                  <span className="font-[family-name:var(--font-geist-mono)] text-[11px] text-[#475569]">
                    {processed.length - visibleCount} remaining
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
