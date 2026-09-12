'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Loading from '@/components/ui/loading'
import {
  Search, LayoutGrid, List, ChevronRight
} from 'lucide-react'

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
  all_covered_tickers: Set<string>
  latest_video_date: string | null
  latest_video_youtube_id: string | null
  bullish_pct: number
  bearish_pct: number
  importance_score: number
}

type SortKey = 'activity' | 'conviction' | 'picks' | 'trust' | 'bullish'
type FilterKey = 'all' | 'bullish' | 'mixed' | 'bearish' | 'high-trust'

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

// ─── Build Profiles with Enhanced Intelligence ───

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

    // Top tickers by frequency and full covered set
    const tickerCount = new Map<string, number>()
    const allCovered = new Set<string>()
    for (const r of chRecs) {
      allCovered.add(r.ticker.toUpperCase())
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

    // Recency score
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
      all_covered_tickers: allCovered,
      latest_video_date: latestVideo?.published_at || null,
      latest_video_youtube_id: latestVideo?.youtube_video_id || null,
      bullish_pct: (bullish / total) * 100,
      bearish_pct: (bearish / total) * 100,
      importance_score,
    }
  }).sort((a, b) => b.importance_score - a.importance_score)
}

// ─── Helpers ───

function getBiasLabel(avgSentiment: number, bullishPct: number): { label: string; color: string; bg: string } {
  if (bullishPct >= 80 || avgSentiment >= 1.2) {
    return { label: 'High Conviction Bull', color: 'text-[#00FFD0]', bg: 'bg-[#00FFD0]/10 border-[#00FFD0]/30' }
  }
  if (avgSentiment >= 0.5 || bullishPct >= 60) {
    return { label: 'Bullish', color: 'text-[#00D4AA]', bg: 'bg-[#00D4AA]/10 border-[#00D4AA]/30' }
  }
  if (avgSentiment <= -1.2 || bullishPct <= 15) {
    return { label: 'Defensive / Bearish', color: 'text-[#FF1744]', bg: 'bg-[#FF1744]/10 border-[#FF1744]/30' }
  }
  if (avgSentiment <= -0.5 || bullishPct <= 35) {
    return { label: 'Cautious Hedged', color: 'text-[#FF4D6A]', bg: 'bg-[#FF4D6A]/10 border-[#FF4D6A]/30' }
  }
  return { label: 'Balanced', color: 'text-[#8B95A8]', bg: 'bg-[#8B95A8]/10 border-[#8B95A8]/30' }
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '—'
  const diff = Date.now() - date.getTime()
  if (diff < 0) return '—'
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
        className="rounded-full object-cover ring-2 ring-white/10 group-hover:ring-[#00D4AA]/50 transition-all duration-300"
        style={{ width: size, height: size }}
        onError={() => setImgError(true)}
      />
    )
  }

  return (
    <div
      className="rounded-full flex items-center justify-center font-[family-name:var(--font-geist-mono)] font-bold ring-2 ring-white/10 group-hover:ring-[#00D4AA]/50 transition-all duration-300"
      style={{ width: size, height: size, backgroundColor: `${color}20`, color }}
    >
      <span style={{ fontSize: size * 0.4 }}>{initial}</span>
    </div>
  )
}

// ─── Mini Conviction Gauge ───

function ConvictionDots({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-1.5" title={`Avg Conviction: ${level.toFixed(1)}/10`}>
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className={`w-1 h-2.5 rounded-[1px] ${
              i < Math.round(level / 2) ? 'bg-[#00D4AA]' : 'bg-[#1E293B]'
            }`}
          />
        ))}
      </div>
      <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[#F1F5F9] font-bold">
        {level.toFixed(1)}
      </span>
    </div>
  )
}

// ─── Card Component ───

function ChannelGridCard({ profile }: { profile: ChannelProfile }) {
  const router = useRouter()
  const bias = getBiasLabel(profile.avg_sentiment, profile.bullish_pct)

  const handleCardClick = () => {
    router.push(`/channel?id=${profile.channel_id}&name=${encodeURIComponent(profile.channel_name)}`)
  }

  return (
    <div
      onClick={handleCardClick}
      className="group relative flex flex-col justify-between p-6 rounded-2xl bg-[#141B2D]/50 hover:bg-[#141B2D]/90 border border-[#1E293B] hover:border-[#00D4AA]/40 transition-all duration-300 hover:-translate-y-1 cursor-pointer shadow-xl shadow-black/20 overflow-hidden"
    >
      {/* Background radial accent */}
      <div
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-br from-[#00D4AA]/10 to-transparent blur-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
      />

      <div>
        {/* Header: Avatar, Name & Trust Badge */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <ChannelAvatar profile={profile} size={48} />
            <div className="min-w-0">
              <h3 className="font-[family-name:var(--font-geist-mono)] text-lg font-bold text-[#F1F5F9] group-hover:text-[#00D4AA] transition-colors truncate">
                {profile.channel_name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${bias.bg} ${bias.color}`}>
                  {bias.label}
                </span>
                <span className="text-[10px] font-[family-name:var(--font-geist-mono)] text-[#64748B]">
                  {profile.trust_weight.toFixed(1)}× Trust
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Pulse Bar */}
        <div className="space-y-1.5 mb-4">
          <div className="flex justify-between items-center text-[10px] font-[family-name:var(--font-geist-mono)] text-[#64748B]">
            <span>{Math.round(profile.bullish_pct)}% Bull</span>
            <span>{Math.round(profile.bearish_pct)}% Bear</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[#0A0F1A] border border-[#1E293B] overflow-hidden flex shadow-inner">
            {profile.bearish_pct > 0 && (
              <div
                className="h-full bg-gradient-to-r from-[#FF1744] to-[#FF4D6A]"
                style={{ width: `${profile.bearish_pct}%` }}
              />
            )}
            <div
              className="h-full bg-[#475569]"
              style={{ width: `${Math.max(0, 100 - profile.bullish_pct - profile.bearish_pct)}%` }}
            />
            {profile.bullish_pct > 0 && (
              <div
                className="h-full bg-gradient-to-r from-[#00D4AA] to-[#00FFD0]"
                style={{ width: `${profile.bullish_pct}%` }}
              />
            )}
          </div>
        </div>

        {/* Key Metrics Strip */}
        <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[#0A0F1A]/60 border border-[#1E293B] mb-4 text-center font-[family-name:var(--font-geist-mono)]">
          <div>
            <span className="text-[9px] uppercase tracking-wider text-[#64748B] block">Calls</span>
            <span className="text-sm font-bold text-[#F1F5F9]">{profile.total_recommendations}</span>
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-wider text-[#64748B] block">Conviction</span>
            <span className="text-sm font-bold text-[#00D4AA]">{profile.avg_conviction.toFixed(1)}</span>
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-wider text-[#64748B] block">Activity</span>
            <span className="text-xs text-[#8B95A8]">{profile.latest_video_date ? timeAgo(profile.latest_video_date) : '—'}</span>
          </div>
        </div>

        {/* Top Tickers Covered */}
        {profile.top_tickers.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#64748B] font-[family-name:var(--font-geist-mono)] block">
              Core Coverage
            </span>
            <div className="flex items-center flex-wrap gap-1.5">
              {profile.top_tickers.map((ticker) => (
                <button
                  key={ticker}
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(`/ticker?s=${ticker}`)
                  }}
                  className="px-2 py-0.5 rounded-md bg-[#0A0F1A] border border-[#1E293B] hover:border-[#00D4AA]/40 text-[#8B95A8] hover:text-[#00D4AA] font-[family-name:var(--font-geist-mono)] text-[11px] font-bold transition-all"
                >
                  {ticker}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer link */}
      <div className="pt-4 border-t border-white/5 mt-5 flex items-center justify-between text-xs font-semibold text-[#00D4AA] group-hover:text-[#00FFD0]">
        <span>Open Analyst Dossier</span>
        <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  )
}

// ─── Main Directory Page ───

export default function ChannelsPage() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<ChannelProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortKey>('activity')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'leaderboard'>('grid')

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()

      async function fetchAll<T>(
        table: string,
        selectStr: string,
        orderBy?: { column: string; ascending: boolean }
      ): Promise<T[]> {
        let allData: T[] = []
        const pageSize = 1000
        let from = 0
        
        while (true) {
          let query = supabase.from(table).select(selectStr).range(from, from + pageSize - 1)
          if (orderBy) {
            query = query.order(orderBy.column, { ascending: orderBy.ascending })
          }
          const { data, error } = await query
          if (error) {
            console.error(`Error fetching ${table}:`, error)
            break
          }
          if (!data || data.length === 0) break
          
          allData = allData.concat(data as unknown as T[])
          if (data.length < pageSize) break
          from += pageSize
        }
        return allData
      }

      const [channelsRes, videosRes, recsRes] = await Promise.all([
        supabase.from('channels').select('channel_id, channel_name, trust_weight, created_at, channel_thumbnail_url, youtube_channel_id'),
        fetchAll<VideoData>('videos', 'video_id, channel_id, youtube_video_id, published_at', { column: 'published_at', ascending: false }),
        fetchAll<RecommendationData>('recommendations', 'ticker, sentiment, conviction_level, target_price, video_id', { column: 'video_id', ascending: true }),
      ])

      const channels = (channelsRes.data || []) as ChannelData[]
      const videos = videosRes || []
      const recs = recsRes || []

      setProfiles(buildProfiles(channels, videos, recs))
      setLoading(false)
    }
    fetchData()
  }, [])

  // Aggregate stats
  const totalRecs = profiles.reduce((s, p) => s + p.total_recommendations, 0)
  const totalVideos = profiles.reduce((s, p) => s + p.total_videos, 0)
  const totalBullish = profiles.reduce((s, p) => s + (p.total_recommendations * (p.bullish_pct / 100)), 0)
  const platformBullRatio = totalRecs > 0 ? Math.round((totalBullish / totalRecs) * 100) : 0

  // Filter counts
  const filterCounts = useMemo(() => {
    const counts: Record<FilterKey, number> = {
      all: profiles.length,
      bullish: 0,
      mixed: 0,
      bearish: 0,
      'high-trust': 0
    }
    for (const p of profiles) {
      if (p.avg_sentiment >= 0.5) counts.bullish++
      else if (p.avg_sentiment <= -0.5) counts.bearish++
      else counts.mixed++

      if (p.trust_weight >= 1.5) counts['high-trust']++
    }
    return counts
  }, [profiles])

  // Processed list (search + filter + sort)
  const processed = useMemo(() => {
    let list = [...profiles]

    // Search by channel name OR ticker covered
    if (search.trim()) {
      const q = search.trim().toUpperCase()
      list = list.filter((p) =>
        p.channel_name.toUpperCase().includes(q) ||
        p.all_covered_tickers.has(q)
      )
    }

    // Filter
    if (filter === 'bullish') list = list.filter((p) => p.avg_sentiment >= 0.5)
    else if (filter === 'bearish') list = list.filter((p) => p.avg_sentiment <= -0.5)
    else if (filter === 'mixed') list = list.filter((p) => p.avg_sentiment > -0.5 && p.avg_sentiment < 0.5)
    else if (filter === 'high-trust') list = list.filter((p) => p.trust_weight >= 1.5)

    // Sort
    switch (sort) {
      case 'conviction':
        list.sort((a, b) => b.avg_conviction - a.avg_conviction)
        break
      case 'picks':
        list.sort((a, b) => b.total_recommendations - a.total_recommendations)
        break
      case 'trust':
        list.sort((a, b) => b.trust_weight - a.trust_weight)
        break
      case 'bullish':
        list.sort((a, b) => b.bullish_pct - a.bullish_pct)
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
  }, [profiles, search, filter, sort])

  if (loading) {
    return <Loading title="Analysts Directory" subtitle="Loading analyst consensus networks..." />
  }

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-[#E2E8F0] px-4 py-8 md:px-8 md:py-12 pb-28 font-[family-name:var(--font-geist-sans)] selection:bg-[#00D4AA]/30">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* ─── Hero Header & Macro Signal Ribbon ─── */}
        <header className="space-y-6 animate-fade-up stagger-1">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-[#00D4AA] animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#64748B] font-[family-name:var(--font-geist-mono)]">
                  Consensus Engine
                </span>
              </div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tight text-[#F1F5F9] font-[family-name:var(--font-geist-mono)]">
                The Analysts
              </h1>
              <p className="text-sm md:text-base text-[#8B95A8] mt-2 max-w-xl font-light">
                Every financial analyst tracked by Aura. Monitor their conviction calibration, coverage footprint, and sentiment history.
              </p>
            </div>

            {/* Macro Stats Strip */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#141B2D]/60 border border-[#1E293B] font-[family-name:var(--font-geist-mono)] text-xs shrink-0 shadow-lg">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-[#64748B] block">Tracked</span>
                <span className="text-base font-bold text-[#F1F5F9]">{profiles.length}</span>
              </div>
              <div className="h-7 w-px bg-[#1E293B]" />
              <div>
                <span className="text-[9px] uppercase tracking-wider text-[#64748B] block">Videos</span>
                <span className="text-base font-bold text-[#F1F5F9]">{totalVideos}</span>
              </div>
              <div className="h-7 w-px bg-[#1E293B]" />
              <div>
                <span className="text-[9px] uppercase tracking-wider text-[#64748B] block">Calls</span>
                <span className="text-base font-bold text-[#00D4AA]">{totalRecs}</span>
              </div>
              <div className="h-7 w-px bg-[#1E293B]" />
              <div>
                <span className="text-[9px] uppercase tracking-wider text-[#64748B] block">Bull Ratio</span>
                <span className="text-base font-bold text-[#00FFD0]">{platformBullRatio}%</span>
              </div>
            </div>
          </div>
        </header>

        {/* ─── Filter, Search & View Controls Bar ─── */}
        <section className="space-y-4 animate-fade-up stagger-2">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl bg-[#141B2D]/60 border border-[#1E293B]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#475569]" />
              <input
                type="text"
                placeholder="Search by analyst name or stock ticker (e.g. NVDA)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#0A0F1A] border border-[#1E293B] text-xs text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#00D4AA]/50 font-[family-name:var(--font-geist-mono)]"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { key: 'all', label: 'All' },
                  { key: 'bullish', label: 'Bullish' },
                  { key: 'mixed', label: 'Mixed' },
                  { key: 'bearish', label: 'Bearish' },
                  { key: 'high-trust', label: 'High Trust (≥1.5×)' },
                ] as const
              ).map((f) => {
                const isActive = filter === f.key
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      isActive
                        ? 'bg-[#00D4AA]/15 border-[#00D4AA]/40 text-[#00D4AA]'
                        : 'bg-[#0A0F1A] border-[#1E293B] text-[#64748B] hover:text-[#E2E8F0]'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className="ml-1.5 text-[10px] font-mono opacity-60">
                      {filterCounts[f.key]}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Sort & View Mode Controls */}
            <div className="flex items-center gap-3 shrink-0">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#0A0F1A] border border-[#1E293B] text-[#8B95A8] focus:outline-none focus:border-[#00D4AA]/50 font-[family-name:var(--font-geist-mono)]"
              >
                <option value="activity">Sort by Activity</option>
                <option value="conviction">Sort by Conviction</option>
                <option value="picks">Sort by Total Calls</option>
                <option value="trust">Sort by Trust Weight</option>
                <option value="bullish">Sort by Bullish %</option>
              </select>

              <div className="flex items-center gap-1 rounded-xl bg-[#0A0F1A] p-1 border border-[#1E293B]">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[#00D4AA]/20 text-[#00D4AA]' : 'text-[#64748B] hover:text-[#F1F5F9]'}`}
                  title="Grid Cards"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('leaderboard')}
                  className={`p-1.5 rounded-lg transition-all ${viewMode === 'leaderboard' ? 'bg-[#00D4AA]/20 text-[#00D4AA]' : 'text-[#64748B] hover:text-[#F1F5F9]'}`}
                  title="Leaderboard Table"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Analysts Content View ─── */}
        {processed.length === 0 ? (
          <div className="p-12 rounded-3xl bg-[#141B2D]/40 border border-[#1E293B] text-center space-y-3 animate-fade-up">
            <p className="text-lg text-[#8B95A8]">No analysts found matching &ldquo;{search}&rdquo;.</p>
            <button
              onClick={() => { setSearch(''); setFilter('all') }}
              className="px-4 py-2 rounded-xl bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-xs font-semibold text-[#00D4AA] hover:bg-[#00D4AA]/20 transition-all"
            >
              Reset Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* ─── GRID CARDS VIEW ─── */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-fade-up stagger-4">
            {processed.map((profile) => (
              <ChannelGridCard key={profile.channel_id} profile={profile} />
            ))}
          </div>
        ) : (
          /* ─── LEADERBOARD TABLE VIEW ─── */
          <div className="rounded-2xl border border-[#1E293B] bg-[#141B2D]/40 overflow-hidden shadow-2xl animate-fade-up stagger-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-[family-name:var(--font-geist-mono)]">
                <thead>
                  <tr className="border-b border-[#1E293B] bg-[#0A0F1A]/90 text-[#64748B] uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4 w-12 text-center">Rank</th>
                    <th className="py-3.5 px-4">Analyst</th>
                    <th className="py-3.5 px-4">Trust Tier</th>
                    <th className="py-3.5 px-4">Consensus Bias</th>
                    <th className="py-3.5 px-4">Conviction</th>
                    <th className="py-3.5 px-4">Total Calls</th>
                    <th className="py-3.5 px-4">Top Tickers</th>
                    <th className="py-3.5 px-4">Latest Video</th>
                    <th className="py-3.5 px-4 text-right">Dossier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]/50 text-[#C8D1DE]">
                  {processed.map((profile, index) => {
                    const bias = getBiasLabel(profile.avg_sentiment, profile.bullish_pct)
                    return (
                      <tr
                        key={profile.channel_id}
                        onClick={() => router.push(`/channel?id=${profile.channel_id}&name=${encodeURIComponent(profile.channel_name)}`)}
                        className="hover:bg-[#141B2D] transition-colors cursor-pointer group"
                      >
                        <td className="py-4 px-4 text-center font-bold text-[#64748B]">
                          #{index + 1}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <ChannelAvatar profile={profile} size={32} />
                            <span className="font-bold text-[#F1F5F9] group-hover:text-[#00D4AA] transition-colors text-sm">
                              {profile.channel_name}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-[#8B95A8] font-bold">
                            {profile.trust_weight.toFixed(1)}×
                          </span>
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${bias.bg} ${bias.color}`}>
                            {bias.label} ({Math.round(profile.bullish_pct)}% Bull)
                          </span>
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <ConvictionDots level={profile.avg_conviction} />
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap font-bold text-[#F1F5F9]">
                          {profile.total_recommendations}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {profile.top_tickers.slice(0, 3).map((ticker) => (
                              <span
                                key={ticker}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  router.push(`/ticker?s=${ticker}`)
                                }}
                                className="px-1.5 py-0.5 rounded bg-[#0A0F1A] border border-[#1E293B] text-[10px] text-[#8B95A8] hover:text-[#00D4AA]"
                              >
                                {ticker}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap text-[#8B95A8]">
                          {profile.latest_video_date ? timeAgo(profile.latest_video_date) : '—'}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap text-right">
                          <span className="text-[#00D4AA] group-hover:text-[#00FFD0] font-bold inline-flex items-center gap-1 text-xs">
                            <span>Inspect</span>
                            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
