'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ─── Types ───

interface ChannelData {
  channel_id: string
  channel_name: string
  trust_weight: number
  created_at: string
  channel_thumbnail_url: string | null
  youtube_channel_id: string | null
}

interface VideoData {
  video_id: string
  channel_id: string
  youtube_video_id: string
  published_at: string
}

interface RecommendationData {
  ticker: string
  sentiment: number
  conviction_level: number
  target_price: number | null
  video_id: string
}

interface ChannelProfile {
  channel_id: string
  channel_name: string
  trust_weight: number
  channel_thumbnail_url: string | null
  youtube_channel_id: string | null
  total_videos: number
  total_recommendations: number
  avg_sentiment: number
  avg_conviction: number
  top_tickers: string[]
  latest_video_date: string | null
  latest_video_youtube_id: string | null
  bullish_pct: number
  bearish_pct: number
  importance_score: number
}

type SortKey = 'activity' | 'conviction' | 'picks'
type FilterKey = 'all' | 'bullish' | 'mixed' | 'bearish'

// ─── Avatar Fallback Colors ───

const AVATAR_COLORS = [
  '#00D4AA', // teal
  '#7C3AED', // purple
  '#F59E0B', // amber
  '#3B82F6', // blue
  '#EC4899', // pink
  '#10B981', // emerald
]

function getAvatarColor(channelId: string): string {
  const code = channelId.charCodeAt(0) + channelId.charCodeAt(channelId.length - 1)
  return AVATAR_COLORS[code % AVATAR_COLORS.length]
}

// ─── Build Profiles with Importance Scoring ───

function buildProfiles(
  channels: ChannelData[],
  videos: VideoData[],
  recommendations: RecommendationData[]
): ChannelProfile[] {
  const videosByChannel = new Map<string, VideoData[]>()
  for (const v of videos) {
    const list = videosByChannel.get(v.channel_id) || []
    list.push(v)
    videosByChannel.set(v.channel_id, list)
  }

  const videoIdToChannel = new Map<string, string>()
  for (const v of videos) {
    videoIdToChannel.set(v.video_id, v.channel_id)
  }

  const recsByChannel = new Map<string, RecommendationData[]>()
  for (const r of recommendations) {
    const channelId = videoIdToChannel.get(r.video_id)
    if (!channelId) continue
    const list = recsByChannel.get(channelId) || []
    list.push(r)
    recsByChannel.set(channelId, list)
  }

  const now = Date.now()

  return channels.map((ch) => {
    const chVideos = videosByChannel.get(ch.channel_id) || []
    const chRecs = recsByChannel.get(ch.channel_id) || []

    const avgSentiment = chRecs.length > 0
      ? chRecs.reduce((s, r) => s + r.sentiment, 0) / chRecs.length
      : 0

    const avgConviction = chRecs.length > 0
      ? chRecs.reduce((s, r) => s + r.conviction_level, 0) / chRecs.length
      : 0

    const bullish = chRecs.filter((r) => r.sentiment >= 1).length
    const bearish = chRecs.filter((r) => r.sentiment <= -1).length
    const total = chRecs.length || 1

    // Top tickers by frequency
    const tickerCount = new Map<string, number>()
    for (const r of chRecs) {
      tickerCount.set(r.ticker, (tickerCount.get(r.ticker) || 0) + 1)
    }
    const topTickers = [...tickerCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t)

    // Sort videos by date, get latest
    const sortedVideos = chVideos.sort(
      (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    )
    const latestVideo = sortedVideos[0] || null

    // Recency score for importance
    const latestDate = latestVideo ? new Date(latestVideo.published_at).getTime() : 0
    const daysSinceLatest = latestDate ? (now - latestDate) / (1000 * 60 * 60 * 24) : 999
    let recencyScore = 0.1
    if (daysSinceLatest <= 7) recencyScore = 1
    else if (daysSinceLatest <= 30) recencyScore = 0.7
    else if (daysSinceLatest <= 90) recencyScore = 0.4

    // Importance score
    const importance_score =
      (chRecs.length * 0.4) +
      (ch.trust_weight * 10 * 0.3) +
      (recencyScore * 10 * 0.3)

    return {
      channel_id: ch.channel_id,
      channel_name: ch.channel_name,
      trust_weight: ch.trust_weight,
      channel_thumbnail_url: ch.channel_thumbnail_url,
      youtube_channel_id: ch.youtube_channel_id,
      total_videos: chVideos.length,
      total_recommendations: chRecs.length,
      avg_sentiment: avgSentiment,
      avg_conviction: avgConviction,
      top_tickers: topTickers,
      latest_video_date: latestVideo?.published_at || null,
      latest_video_youtube_id: latestVideo?.youtube_video_id || null,
      bullish_pct: (bullish / total) * 100,
      bearish_pct: (bearish / total) * 100,
      importance_score,
    }
  }).sort((a, b) => b.importance_score - a.importance_score)
}

// ─── Helpers ───

function getBiasLabel(avgSentiment: number, bullishPct: number): { label: string; color: string } {
  if (bullishPct >= 80 || avgSentiment >= 1.0) return { label: 'Very Bullish', color: 'text-[#00FFD0]' }
  if (avgSentiment >= 0.5 || bullishPct >= 60) return { label: 'Bullish', color: 'text-[#00D4AA]' }
  if (avgSentiment <= -1.0 || bullishPct <= 10) return { label: 'Very Bearish', color: 'text-[#FF1744]' }
  if (avgSentiment <= -0.5 || bullishPct <= 30) return { label: 'Bearish', color: 'text-[#FF4D6A]' }
  return { label: 'Mixed', color: 'text-[#8B95A8]' }
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  if (diff < 0) return ''
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return '1d ago'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── ChannelAvatar ───

function ChannelAvatar({ profile, size = 48 }: { profile: ChannelProfile; size?: number }) {
  const [imgError, setImgError] = useState(false)
  const color = getAvatarColor(profile.channel_id)
  const initial = profile.channel_name.charAt(0).toUpperCase()

  if (profile.channel_thumbnail_url && !imgError) {
    return (
      <img
        src={profile.channel_thumbnail_url}
        alt={profile.channel_name}
        width={size}
        height={size}
        className="rounded-full object-cover ring-2 ring-[#1E293B] group-hover:ring-[#00D4AA]/40 transition-all duration-300"
        style={{ width: size, height: size }}
        onError={() => setImgError(true)}
      />
    )
  }

  return (
    <div
      className="rounded-full flex items-center justify-center font-[family-name:var(--font-geist-mono)] font-bold ring-2 ring-[#1E293B] group-hover:ring-[#00D4AA]/40 transition-all duration-300"
      style={{ width: size, height: size, backgroundColor: `${color}20`, color }}
    >
      <span style={{ fontSize: size * 0.4 }}>{initial}</span>
    </div>
  )
}

// ─── SortFilterBar ───

function SortFilterBar({
  sort,
  setSort,
  filter,
  setFilter,
  search,
  setSearch,
  counts,
}: {
  sort: SortKey
  setSort: (s: SortKey) => void
  filter: FilterKey
  setFilter: (f: FilterKey) => void
  search: string
  setSearch: (s: string) => void
  counts: Record<FilterKey, number>
}) {
  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'activity', label: 'Activity' },
    { key: 'conviction', label: 'Conviction' },
    { key: 'picks', label: 'Picks' },
  ]

  const filterOptions: { key: FilterKey; label: string; activeColor: string; activeBg: string }[] = [
    { key: 'all', label: 'All', activeColor: 'text-[#F1F5F9]', activeBg: 'bg-[#1E293B] border-[#2D3A4F]' },
    { key: 'bullish', label: 'Bullish', activeColor: 'text-[#00D4AA]', activeBg: 'bg-[#00D4AA]/10 border-[#00D4AA]/30' },
    { key: 'mixed', label: 'Mixed', activeColor: 'text-[#8B95A8]', activeBg: 'bg-[#8B95A8]/10 border-[#8B95A8]/30' },
    { key: 'bearish', label: 'Bearish', activeColor: 'text-[#FF4D6A]', activeBg: 'bg-[#FF4D6A]/10 border-[#FF4D6A]/30' },
  ]

  return (
    <div className="space-y-3">
      {/* Search + filter pills */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-[280px]">
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]"
          >
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search channels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0A0F1A] border border-[#1E293B] text-sm text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#00D4AA]/50 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {filterOptions.map((f) => {
            const isActive = filter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 ${
                  isActive
                    ? `${f.activeBg} ${f.activeColor}`
                    : 'bg-transparent border-transparent text-[#64748B] hover:border-[#1E293B] hover:bg-[#141B2D]/40'
                }`}
              >
                {f.label}
                <span className={`ml-1.5 font-[family-name:var(--font-geist-mono)] text-[10px] ${isActive ? 'opacity-80' : 'opacity-50'}`}>
                  {counts[f.key]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Sort row */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-[0.15em] text-[#475569] mr-1">Sort</span>
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
  )
}

// ─── ChannelHeroCard ───

function ChannelHeroCard({ profile }: { profile: ChannelProfile }) {
  const bias = getBiasLabel(profile.avg_sentiment, profile.bullish_pct)
  const bgImage = profile.channel_thumbnail_url
    || (profile.latest_video_youtube_id ? `https://i.ytimg.com/vi/${profile.latest_video_youtube_id}/mqdefault.jpg` : null)

  return (
    <Link
      href={`/channel?id=${profile.channel_id}`}
      className="group relative col-span-1 md:col-span-2 lg:col-span-2 block rounded-2xl border border-[#1E293B] bg-[#141B2D] overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#00D4AA]/10 hover:border-[#00D4AA]/30 animate-fade-up stagger-1"
    >
      {/* Background: video thumbnail atmosphere */}
      {bgImage && (
        <div className="absolute inset-0 z-0">
          <img
            src={bgImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover blur-sm opacity-25"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0F1A] via-[#0A0F1A]/80 to-[#0A0F1A]/50" />
        </div>
      )}

      <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row md:items-start gap-6">
        {/* Left: Avatar + identity */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <ChannelAvatar profile={profile} size={64} />
          <div className="flex-1 min-w-0">
            <h3 className="font-[family-name:var(--font-geist-mono)] text-2xl md:text-3xl font-bold text-[#F1F5F9] tracking-tight group-hover:text-[#00D4AA] transition-colors break-words">
              {profile.channel_name}
            </h3>
            <div className={`text-xl md:text-2xl font-semibold mt-1 ${bias.color}`}>
              {bias.label}
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-[#64748B]">
              <span>{profile.total_videos} video{profile.total_videos !== 1 ? 's' : ''}</span>
              <span className="text-[#1E293B]">·</span>
              <span>{profile.total_recommendations} picks</span>
              {profile.latest_video_date && (
                <>
                  <span className="text-[#1E293B]">·</span>
                  <span>{timeAgo(profile.latest_video_date)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Stats */}
        <div className="flex items-center gap-6 md:gap-8 shrink-0">
          <div className="text-center">
            <div className="font-[family-name:var(--font-geist-mono)] text-3xl font-bold text-[#F1F5F9]">
              {profile.total_recommendations}
            </div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-[#475569] mt-0.5">Picks</div>
          </div>
          <div className="text-center">
            <div className="font-[family-name:var(--font-geist-mono)] text-3xl font-bold text-[#F1F5F9]">
              {profile.avg_conviction.toFixed(1)}
            </div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-[#475569] mt-0.5">Conviction</div>
          </div>
          <div className="text-center">
            <div className="font-[family-name:var(--font-geist-mono)] text-3xl font-bold text-[#F1F5F9]">
              {profile.trust_weight.toFixed(1)}<span className="text-lg text-[#475569]">×</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-[#475569] mt-0.5">Trust</div>
          </div>
        </div>
      </div>

      {/* Bottom: Sentiment pulse + tickers */}
      <div className="relative z-10 px-6 md:px-8 pb-6 md:pb-8">
        {/* Pulse bar */}
        <div className="relative w-full h-2 rounded-full bg-[#1E293B] overflow-hidden mb-4">
          <div
            className="absolute inset-y-0 left-0 rounded-full pulse-bar-fill"
            style={{
              width: `${((profile.avg_sentiment + 2) / 4) * 100}%`,
              background: 'linear-gradient(90deg, #FF1744 0%, #FF4D6A 20%, #F59E0B 50%, #00D4AA 80%, #00FFD0 100%)',
            }}
          />
        </div>

        {/* Ticker pills + date */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center flex-wrap gap-1.5">
            {profile.top_tickers.slice(0, 5).map((ticker) => (
              <span
                key={ticker}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/ticker?s=${ticker}` }}
                className="font-[family-name:var(--font-geist-mono)] text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#0A0F1A]/80 border border-[#1E293B] text-[#8B95A8] hover:text-[#00D4AA] hover:border-[#00D4AA]/30 transition-all cursor-pointer relative z-20"
              >
                {ticker}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Glow overlay */}
      <div
        className="absolute -inset-px rounded-2xl pointer-events-none z-0"
        style={{ background: 'radial-gradient(ellipse at top, rgba(0,212,170,0.04) 0%, transparent 60%)' }}
        aria-hidden="true"
      />
    </Link>
  )
}

// ─── ChannelCompactCard ───

function ChannelCompactCard({ profile, index }: { profile: ChannelProfile; index: number }) {
  const staggerClass = `stagger-${Math.min(index + 1, 10)}`
  const bias = getBiasLabel(profile.avg_sentiment, profile.bullish_pct)
  const bgImage = profile.channel_thumbnail_url
    || (profile.latest_video_youtube_id ? `https://i.ytimg.com/vi/${profile.latest_video_youtube_id}/mqdefault.jpg` : null)

  return (
    <Link
      href={`/channel?id=${profile.channel_id}`}
      className={`group relative block rounded-xl border border-[#1E293B] bg-[#141B2D]/60 overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#00D4AA]/5 hover:border-[#2D3A4F] animate-fade-up ${staggerClass}`}
    >
      {/* Background: video thumbnail atmosphere */}
      {bgImage && (
        <div className="absolute inset-0 z-0">
          <img
            src={bgImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover blur-sm opacity-20"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#141B2D] via-[#141B2D]/80 to-[#141B2D]/50" />
        </div>
      )}

      <div className="relative z-10 p-5">
        {/* Top: Avatar + name */}
        <div className="flex items-center gap-3 mb-3">
          <ChannelAvatar profile={profile} size={40} />
          <div className="flex-1 min-w-0">
            <h3 className="font-[family-name:var(--font-geist-mono)] text-lg font-bold text-[#F1F5F9] tracking-tight group-hover:text-[#00D4AA] transition-colors truncate">
              {profile.channel_name}
            </h3>
            <span className={`text-sm font-medium ${bias.color}`}>
              {bias.label}
            </span>
          </div>
        </div>

        {/* Mini pulse bar */}
        <div className="relative w-full h-[3px] rounded-full bg-[#1E293B] overflow-hidden mb-3">
          <div
            className="absolute inset-y-0 left-0 rounded-full pulse-bar-fill"
            style={{
              width: `${((profile.avg_sentiment + 2) / 4) * 100}%`,
              background: 'linear-gradient(90deg, #FF1744 0%, #FF4D6A 20%, #F59E0B 50%, #00D4AA 80%, #00FFD0 100%)',
            }}
          />
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between text-[11px] font-[family-name:var(--font-geist-mono)] text-[#64748B] mb-3">
          <span><span className="text-[#8B95A8]">{profile.total_recommendations}</span> picks</span>
          <span><span className="text-[#8B95A8]">{profile.avg_conviction.toFixed(1)}</span>/10</span>
          <span><span className="text-[#8B95A8]">{profile.trust_weight.toFixed(1)}</span>×</span>
        </div>

        {/* Ticker pills */}
        {profile.top_tickers.length > 0 && (
          <div className="flex items-center flex-wrap gap-1">
            {profile.top_tickers.slice(0, 3).map((ticker) => (
              <span
                key={ticker}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/ticker?s=${ticker}` }}
                className="font-[family-name:var(--font-geist-mono)] text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#0A0F1A] border border-[#1E293B] text-[#64748B] hover:text-[#00D4AA] hover:border-[#00D4AA]/30 transition-all cursor-pointer relative z-20"
              >
                {ticker}
              </span>
            ))}
            {profile.top_tickers.length > 3 && (
              <span className="text-[10px] text-[#475569]">+{profile.top_tickers.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}

// ─── Main Page Component ───

export default function ChannelsPage() {
  const [profiles, setProfiles] = useState<ChannelProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortKey>('activity')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()

      const [channelsRes, videosRes, recsRes] = await Promise.all([
        supabase.from('channels').select('channel_id, channel_name, trust_weight, created_at, channel_thumbnail_url, youtube_channel_id'),
        supabase.from('videos').select('video_id, channel_id, youtube_video_id, published_at'),
        supabase.from('recommendations').select('ticker, sentiment, conviction_level, target_price, video_id'),
      ])

      const channels = (channelsRes.data || []) as ChannelData[]
      const videos = (videosRes.data || []) as VideoData[]
      const recs = (recsRes.data || []) as RecommendationData[]

      setProfiles(buildProfiles(channels, videos, recs))
      setLoading(false)
    }
    fetchData()
  }, [])

  // Filter counts
  const filterCounts = useMemo(() => {
    const counts: Record<FilterKey, number> = { all: profiles.length, bullish: 0, mixed: 0, bearish: 0 }
    for (const p of profiles) {
      if (p.avg_sentiment >= 0.5) counts.bullish++
      else if (p.avg_sentiment <= -0.5) counts.bearish++
      else counts.mixed++
    }
    return counts
  }, [profiles])

  // Sort + filter + search
  const processed = useMemo(() => {
    let list = [...profiles]

    // Filter
    if (filter === 'bullish') list = list.filter((p) => p.avg_sentiment >= 0.5)
    else if (filter === 'bearish') list = list.filter((p) => p.avg_sentiment <= -0.5)
    else if (filter === 'mixed') list = list.filter((p) => p.avg_sentiment > -0.5 && p.avg_sentiment < 0.5)

    // Search
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((p) => p.channel_name.toLowerCase().includes(q))
    }

    // Sort
    switch (sort) {
      case 'conviction':
        list.sort((a, b) => b.avg_conviction - a.avg_conviction)
        break
      case 'picks':
        list.sort((a, b) => b.total_recommendations - a.total_recommendations)
        break
      case 'activity':
      default:
        list.sort((a, b) => {
          const dateA = a.latest_video_date ? new Date(a.latest_video_date).getTime() : 0
          const dateB = b.latest_video_date ? new Date(b.latest_video_date).getTime() : 0
          return dateB - dateA
        })
    }

    return list
  }, [profiles, sort, filter, search])

  // Hero threshold: top 70th percentile AND >= 5 recs
  const heroProfiles = useMemo(() => {
    if (processed.length < 3) return []
    const scores = processed.map((p) => p.importance_score).sort((a, b) => b - a)
    const threshold = scores[Math.floor(scores.length * 0.3)] || 0
    const heroes = processed.filter(
      (p) => p.importance_score >= threshold && p.total_recommendations >= 5
    )
    // Max 2 heroes to avoid layout weirdness
    return heroes.slice(0, 2)
  }, [processed])

  const compactProfiles = useMemo(() => {
    const heroIds = new Set(heroProfiles.map((p) => p.channel_id))
    return processed.filter((p) => !heroIds.has(p.channel_id))
  }, [processed, heroProfiles])

  // Aggregate stats
  const totalRecs = profiles.reduce((s, p) => s + p.total_recommendations, 0)
  const totalVideos = profiles.reduce((s, p) => s + p.total_videos, 0)

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div className="absolute glow-emerge" style={{ width: '200px', height: '200px', animationDelay: '300ms' }}>
            <div className="aura-glow" />
          </div>
          <div className="relative text-center">
            <div className="text-5xl font-extralight tracking-[0.2em] logo-sweep">
              {'Channels'.split('').map((letter, i) => (
                <span
                  key={i}
                  className="logo-letter letter-materialize"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {letter}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-[#64748B] byline-appear" style={{ animationDelay: '700ms' }}>
              Loading analyst profiles...
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Empty state
  if (profiles.length === 0) {
    return (
      <div className="min-h-screen px-4 py-8 md:px-8 md:py-12">
        <div className="max-w-5xl mx-auto">
          <header className="mt-12 mb-12 animate-fade-up stagger-1">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-[#F1F5F9]">
              The Analysts
            </h1>
          </header>
          <div className="rounded-xl border border-[#1E293B] bg-[#141B2D]/40 p-12 text-center animate-fade-up stagger-2">
            <p className="text-lg text-[#8B95A8]">No channels yet.</p>
            <p className="mt-2 text-sm text-[#64748B]">
              Channels appear once a video is ingested.{' '}
              <Link href="/admin/ingest" className="text-[#00D4AA] hover:underline">
                Ingest a video
              </Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 md:py-12 pb-24">
      <div className="max-w-6xl mx-auto">
        {/* Page header */}
        <header className="mt-12 mb-4 animate-fade-up stagger-1">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-[#F1F5F9]">
            The Analysts
          </h1>
          <p className="mt-3 text-lg text-[#8B95A8] font-light max-w-lg">
            Every channel tracked by aura. Their signal, their conviction, their coverage.
          </p>
        </header>

        {/* Aggregate stats strip */}
        <div className="flex items-center gap-4 mb-8 animate-fade-up stagger-2">
          <div className="font-[family-name:var(--font-geist-mono)] text-xs text-[#64748B] tracking-wide flex items-center gap-3">
            <span><span className="text-[#8B95A8]">{profiles.length}</span> channels</span>
            <span className="text-[#1E293B]">·</span>
            <span><span className="text-[#8B95A8]">{totalVideos}</span> videos</span>
            <span className="text-[#1E293B]">·</span>
            <span><span className="text-[#8B95A8]">{totalRecs}</span> recommendations</span>
          </div>
        </div>

        {/* Pulse line separator */}
        <div className="relative h-px mb-8 animate-fade-up stagger-2">
          <div className="absolute inset-0 bg-[#1E293B]" />
          <div className="absolute inset-0 h-px bg-gradient-to-r from-transparent via-[#00D4AA] to-transparent hero-pulse-line" />
        </div>

        {/* Sort/Filter bar — sticky */}
        <div className="sticky top-[72px] z-10 bg-[#0A0F1A]/95 backdrop-blur-xl py-3 -mx-4 px-4 mb-6 animate-fade-up stagger-3">
          <SortFilterBar
            sort={sort}
            setSort={setSort}
            filter={filter}
            setFilter={setFilter}
            search={search}
            setSearch={setSearch}
            counts={filterCounts}
          />
        </div>

        {/* Magazine Grid */}
        {processed.length === 0 ? (
          <div className="rounded-xl border border-[#1E293B] bg-[#141B2D]/40 p-12 text-center animate-fade-up">
            <p className="text-lg text-[#8B95A8]">No channels match your filters.</p>
            <button
              onClick={() => { setFilter('all'); setSearch('') }}
              className="mt-3 text-sm text-[#00D4AA] hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 grid-flow-dense">
            {/* Hero cards */}
            {heroProfiles.map((profile) => (
              <ChannelHeroCard key={profile.channel_id} profile={profile} />
            ))}

            {/* Compact cards */}
            {compactProfiles.map((profile, index) => (
              <ChannelCompactCard
                key={profile.channel_id}
                profile={profile}
                index={index + heroProfiles.length}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
