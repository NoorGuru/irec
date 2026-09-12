'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Loading from '@/components/ui/loading'
import {
  ArrowLeft, ExternalLink, ShieldCheck, Target, TrendingUp, TrendingDown,
  Activity, Search, Copy, Check, LayoutGrid, List, Play,
  ChevronRight, ChevronDown, ChevronUp
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

/* ─── Types ─── */

interface ChannelRow {
  channel_id: string
  channel_name: string
  trust_weight: number
  created_at: string
  youtube_channel_id: string | null
  channel_thumbnail_url: string | null
}

interface VideoRow {
  video_id: string
  video_url: string
  youtube_video_id: string
  published_at: string
  title: string | null
  duration: string | null
  video_summary: string | null
}

interface RecommendationRow {
  id: string
  video_id: string
  ticker: string
  stock_name: string | null
  sentiment: number
  target_price: number | null
  conviction_level: number
  catalyst_notes: string
}

interface TickerBreakdown {
  ticker: string
  stock_name: string | null
  count: number
  avg_sentiment: number
  avg_conviction: number
  avg_target: number | null
  sentiments: number[]
  latest_catalyst: string | null
}

interface VideoWithRecs extends VideoRow {
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

function getSentimentBg(s: number): string {
  if (s >= 1.5) return 'bg-[#00FFD0]'
  if (s >= 0.5) return 'bg-[#00D4AA]'
  if (s <= -1.5) return 'bg-[#FF1744]'
  if (s <= -0.5) return 'bg-[#FF4D6A]'
  return 'bg-[#475569]'
}

function getSentimentBadgeClass(s: number): string {
  if (s >= 1.5) return "sentiment-badge sentiment-badge-strong-buy"
  if (s >= 0.5) return "sentiment-badge sentiment-badge-buy"
  if (s > -0.5) return "sentiment-badge sentiment-badge-neutral"
  if (s > -1.5) return "sentiment-badge sentiment-badge-sell"
  return "sentiment-badge sentiment-badge-strong-sell"
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

function getYoutubeThumbnail(youtubeVideoId: string): string {
  return `https://i.ytimg.com/vi/${youtubeVideoId}/mqdefault.jpg`
}

function getBiasDetails(avgSentiment: number, bullishPct: number): { label: string; color: string; desc: string } {
  if (bullishPct >= 80 || avgSentiment >= 1.2) {
    return {
      label: 'High Conviction Bull',
      color: 'text-[#00FFD0]',
      desc: 'Aggressively oriented toward growth and expansion catalysts.'
    }
  }
  if (avgSentiment >= 0.5 || bullishPct >= 60) {
    return {
      label: 'Bullish Leaning',
      color: 'text-[#00D4AA]',
      desc: 'Consistently identifies upside opportunities across coverage.'
    }
  }
  if (avgSentiment <= -1.2 || bullishPct <= 15) {
    return {
      label: 'Defensive / Bearish',
      color: 'text-[#FF1744]',
      desc: 'Focuses heavily on market overvaluation and downside risk hedges.'
    }
  }
  if (avgSentiment <= -0.5 || bullishPct <= 35) {
    return {
      label: 'Cautious / Hedged',
      color: 'text-[#FF4D6A]',
      desc: 'Selective stock picker with strict valuation scrutiny.'
    }
  }
  return {
    label: 'Balanced / Pragmatic',
    color: 'text-[#8B95A8]',
    desc: 'Even-handed distribution between long positions and risk callouts.'
  }
}

/* ─── Subcomponents ─── */

function ConvictionMeter({ level }: { level: number }) {
  const normalized = Math.min(Math.max(Math.round(level), 1), 10)
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1" title={`Conviction: ${level.toFixed(1)}/10`}>
        {Array.from({ length: 10 }, (_, i) => {
          const active = i < normalized
          let color = 'bg-[#1E293B]'
          if (active) {
            if (i < 4) color = 'bg-[#00D4AA]/60'
            else if (i < 7) color = 'bg-[#00D4AA]'
            else color = 'bg-[#00FFD0] shadow-[0_0_8px_rgba(0,255,208,0.5)]'
          }
          return (
            <div
              key={i}
              className={`w-1.5 h-3.5 rounded-sm transition-all duration-300 ${color}`}
            />
          )
        })}
      </div>
      <span className="font-[family-name:var(--font-geist-mono)] text-xs font-bold text-[#F1F5F9]">
        {level.toFixed(1)}<span className="text-[#64748B] font-normal text-[10px]">/10</span>
      </span>
    </div>
  )
}

function MiniConvictionPill({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => {
          const filled = i < Math.round(level / 2)
          return (
            <div
              key={i}
              className={`w-1 h-2.5 rounded-[1px] ${filled ? 'bg-[#00D4AA]' : 'bg-[#1E293B]'}`}
            />
          )
        })}
      </div>
      <span className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[#8B95A8]">
        {level.toFixed(1)}
      </span>
    </div>
  )
}

/* ─── Main Channel Dossier Content ─── */

function ChannelContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const channelId = searchParams.get('id') || ''
  const nameParam = searchParams.get('name') || ''

  const [channel, setChannel] = useState<ChannelRow | null>(null)
  const [videos, setVideos] = useState<VideoRow[]>([])
  const [recommendations, setRecommendations] = useState<RecommendationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  // Filters and views
  const [coverageFilter, setCoverageFilter] = useState<'all' | 'bullish' | 'bearish' | 'target'>('all')
  const [coverageSort, setCoverageSort] = useState<'calls' | 'conviction' | 'ticker'>('calls')
  const [viewMode, setViewMode] = useState<'dossier' | 'terminal'>('dossier')
  const [videoSearch, setVideoSearch] = useState('')

  // Smart Progressive Disclosure & Pagination States
  const [coverageVisibleCount, setCoverageVisibleCount] = useState<number>(8)
  const [videoVisibleCount, setVideoVisibleCount] = useState<number>(4)

  useEffect(() => {
    let active = true

    async function fetchData() {
      if (!channelId) {
        if (active) setLoading(false)
        return
      }

      const supabase = createClient()

      const [channelRes, videosRes] = await Promise.all([
        supabase.from('channels').select('*').eq('channel_id', channelId).single(),
        supabase.from('videos').select('video_id, video_url, youtube_video_id, published_at, title, duration, video_summary').eq('channel_id', channelId).order('published_at', { ascending: false }),
      ])

      if (!active) return

      if (!channelRes.data) {
        setLoading(false)
        return
      }

      setChannel(channelRes.data as ChannelRow)
      const vids = (videosRes.data || []) as VideoRow[]
      setVideos(vids)

      if (vids.length > 0) {
        const videoIds = vids.map(v => v.video_id)
        const { data: recs } = await supabase
          .from('recommendations')
          .select('id, video_id, ticker, stock_name, sentiment, target_price, conviction_level, catalyst_notes')
          .in('video_id', videoIds)

        if (active) {
          setRecommendations((recs || []) as RecommendationRow[])
        }
      }

      if (active) {
        setLoading(false)
      }
    }

    fetchData()
    return () => { active = false }
  }, [channelId])

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Compute analytics
  const allRecs = recommendations
  const bullishCount = allRecs.filter(r => r.sentiment >= 1).length
  const bearishCount = allRecs.filter(r => r.sentiment <= -1).length
  const neutralCount = allRecs.filter(r => r.sentiment === 0).length
  const totalRecs = allRecs.length || 1
  const bullishPct = (bullishCount / totalRecs) * 100
  const bearishPct = (bearishCount / totalRecs) * 100
  const neutralPct = (neutralCount / totalRecs) * 100

  const avgSentiment = allRecs.length > 0
    ? allRecs.reduce((s, r) => s + r.sentiment, 0) / allRecs.length
    : 0

  const avgConviction = allRecs.length > 0
    ? allRecs.reduce((s, r) => s + r.conviction_level, 0) / allRecs.length
    : 0

  const priceTargets = allRecs.filter(r => r.target_price !== null && r.target_price > 0).map(r => r.target_price!)
  const avgTarget = priceTargets.length > 0
    ? priceTargets.reduce((a, b) => a + b, 0) / priceTargets.length
    : null

  const bias = getBiasDetails(avgSentiment, bullishPct)

  // Ticker breakdown memoized
  const tickerMap = useMemo(() => {
    const map = new Map<string, { stock_name: string | null; sentiments: number[]; convictions: number[]; prices: number[]; catalysts: string[] }>()
    for (const rec of allRecs) {
      if (!map.has(rec.ticker)) {
        map.set(rec.ticker, {
          stock_name: rec.stock_name || null,
          sentiments: [],
          convictions: [],
          prices: [],
          catalysts: []
        })
      }
      const entry = map.get(rec.ticker)!
      entry.sentiments.push(rec.sentiment)
      entry.convictions.push(rec.conviction_level)
      if (rec.stock_name && !entry.stock_name) entry.stock_name = rec.stock_name
      if (rec.target_price !== null) entry.prices.push(rec.target_price)
      if (rec.catalyst_notes) entry.catalysts.push(rec.catalyst_notes)
    }
    return map
  }, [allRecs])

  const allTickerBreakdowns: TickerBreakdown[] = useMemo(() => {
    return [...tickerMap.entries()]
      .map(([ticker, data]) => ({
        ticker,
        stock_name: data.stock_name,
        count: data.sentiments.length,
        avg_sentiment: data.sentiments.reduce((a, b) => a + b, 0) / data.sentiments.length,
        avg_conviction: data.convictions.reduce((a, b) => a + b, 0) / data.convictions.length,
        avg_target: data.prices.length > 0 ? data.prices.reduce((a, b) => a + b, 0) / data.prices.length : null,
        sentiments: data.sentiments,
        latest_catalyst: data.catalysts.length > 0 ? data.catalysts[data.catalysts.length - 1] : null
      }))
  }, [tickerMap])

  // Filtered & sorted ticker breakdowns
  const filteredTickerBreakdowns = useMemo(() => {
    let list = [...allTickerBreakdowns]
    if (coverageFilter === 'bullish') list = list.filter(b => b.avg_sentiment >= 0.5)
    else if (coverageFilter === 'bearish') list = list.filter(b => b.avg_sentiment <= -0.5)
    else if (coverageFilter === 'target') list = list.filter(b => b.avg_target !== null)

    switch (coverageSort) {
      case 'conviction':
        list.sort((a, b) => b.avg_conviction - a.avg_conviction)
        break
      case 'ticker':
        list.sort((a, b) => a.ticker.localeCompare(b.ticker))
        break
      case 'calls':
      default:
        list.sort((a, b) => b.count - a.count)
        break
    }
    return list
  }, [allTickerBreakdowns, coverageFilter, coverageSort])

  // Videos with recommendations
  const videosWithRecs: VideoWithRecs[] = useMemo(() => {
    const list = videos.map(v => ({
      ...v,
      recommendations: allRecs.filter(r => r.video_id === v.video_id),
    }))

    if (!videoSearch.trim()) return list

    const q = videoSearch.toLowerCase()
    return list.filter(v =>
      (v.title && v.title.toLowerCase().includes(q)) ||
      v.recommendations.some(r =>
        r.ticker.toLowerCase().includes(q) ||
        (r.stock_name && r.stock_name.toLowerCase().includes(q)) ||
        (r.catalyst_notes && r.catalyst_notes.toLowerCase().includes(q))
      )
    )
  }, [videos, allRecs, videoSearch])

  // Smart Progressive Disclosure slices
  const displayedCoverage = useMemo(() => {
    return filteredTickerBreakdowns.slice(0, coverageVisibleCount)
  }, [filteredTickerBreakdowns, coverageVisibleCount])

  const hasMoreCoverage = filteredTickerBreakdowns.length > displayedCoverage.length

  const displayedVideos = useMemo(() => {
    return videosWithRecs.slice(0, videoVisibleCount)
  }, [videosWithRecs, videoVisibleCount])

  const hasMoreVideos = videosWithRecs.length > displayedVideos.length

  if (loading) {
    const displayTitle = channel?.channel_name || nameParam || 'Analyst Dossier'
    return (
      <Loading
        title={displayTitle}
        subtitle={`Decrypting ${displayTitle}'s analyst dossier and historical stock calls...`}
      />
    )
  }

  if (!channelId || !channel) {
    return (
      <div className="min-h-screen px-4 py-16 flex items-center justify-center">
        <div className="max-w-md w-full p-8 rounded-2xl bg-[#141B2D]/70 border border-[#1E293B] text-center">
          <ShieldCheck className="w-12 h-12 text-[#64748B] mx-auto mb-4 opacity-50" />
          <h1 className="text-2xl font-bold text-[#F1F5F9]">Analyst Not Found</h1>
          <p className="mt-2 text-sm text-[#8B95A8]">This channel does not exist or has been removed from indexing.</p>
          <Link
            href="/channels"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA] text-sm font-semibold hover:bg-[#00D4AA]/20 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Analysts</span>
          </Link>
        </div>
      </div>
    )
  }

  // Accent theme based on bias
  const glowGradient = avgSentiment >= 0.5
    ? 'from-[#00D4AA]/15 via-[#00D4AA]/5 to-transparent'
    : avgSentiment <= -0.5
    ? 'from-[#FF4D6A]/15 via-[#FF4D6A]/5 to-transparent'
    : 'from-[#8B95A8]/10 via-transparent to-transparent'

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-[#E2E8F0] px-4 py-8 md:px-8 md:py-12 pb-28 selection:bg-[#00D4AA]/30 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* ─── Breadcrumb & Quick Actions Bar ─── */}
        <div className="flex items-center justify-between gap-4 flex-wrap animate-fade-up">
          <Link
            href="/channels"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#64748B] hover:text-[#00D4AA] transition-colors font-[family-name:var(--font-geist-mono)]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Analysts Directory</span>
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141B2D]/80 border border-[#1E293B] hover:border-[#00D4AA]/30 text-xs text-[#8B95A8] hover:text-[#F1F5F9] transition-all"
              title="Copy dossier link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#00D4AA]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Share Dossier'}</span>
            </button>

            {channel.youtube_channel_id && (
              <a
                href={`https://www.youtube.com/channel/${channel.youtube_channel_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#FF0000]/10 border border-[#FF0000]/30 hover:bg-[#FF0000]/20 text-xs font-semibold text-[#FF4D6A] hover:text-[#FF1744] transition-all font-[family-name:var(--font-geist-mono)]"
              >
                <span>YouTube</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* ─── Quick Jump Navigation Strip ─── */}
        <div className="sticky top-20 z-30 p-1.5 rounded-2xl bg-[#0A0F1A]/90 backdrop-blur-xl border border-[#1E293B] shadow-xl flex items-center gap-1.5 overflow-x-auto scrollbar-none font-[family-name:var(--font-geist-mono)] text-xs animate-fade-up">
          <button
            onClick={() => {
              document.getElementById('analyst-overview')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            className="px-3.5 py-1.5 rounded-xl bg-[#141B2D] hover:bg-[#1E293B] text-[#8B95A8] hover:text-[#F1F5F9] border border-transparent hover:border-white/10 transition-all shrink-0 flex items-center gap-1.5 font-bold"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#00D4AA]" />
            <span>Overview</span>
          </button>
          <button
            onClick={() => {
              document.getElementById('coverage-matrix')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            className="px-3.5 py-1.5 rounded-xl bg-[#141B2D] hover:bg-[#1E293B] text-[#8B95A8] hover:text-[#F1F5F9] border border-transparent hover:border-white/10 transition-all shrink-0 flex items-center gap-1.5 font-bold"
          >
            <Activity className="w-3.5 h-3.5 text-[#00D4AA]" />
            <span>Position Coverage</span>
            <span className="px-1.5 py-0.5 rounded-md bg-[#0A0F1A] text-[10px] text-[#00D4AA] border border-[#00D4AA]/20">
              {filteredTickerBreakdowns.length}
            </span>
          </button>
          <button
            onClick={() => {
              document.getElementById('video-ledger')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            className="px-3.5 py-1.5 rounded-xl bg-[#141B2D] hover:bg-[#1E293B] text-[#8B95A8] hover:text-[#F1F5F9] border border-transparent hover:border-white/10 transition-all shrink-0 flex items-center gap-1.5 font-bold"
          >
            <Play className="w-3.5 h-3.5 text-[#00D4AA]" />
            <span>Video Evidence</span>
            <span className="px-1.5 py-0.5 rounded-md bg-[#0A0F1A] text-[10px] text-[#00D4AA] border border-[#00D4AA]/20">
              {videosWithRecs.length}
            </span>
          </button>
        </div>

        {/* ─── Institutional Analyst Dossier Hero ─── */}
        <header id="analyst-overview" className="relative rounded-3xl border border-white/5 bg-[#141B2D]/70 backdrop-blur-xl overflow-hidden p-6 md:p-10 shadow-2xl shadow-black/40 animate-fade-up stagger-1 scroll-mt-28">
          {/* Ambient Glow */}
          <div className={`absolute -top-24 -right-24 w-96 h-96 rounded-full bg-gradient-to-br ${glowGradient} blur-3xl pointer-events-none opacity-80`} />
          
          {/* Subtle Video Atmosphere Backdrop */}
          {channel.channel_thumbnail_url && (
            <div className="absolute inset-0 pointer-events-none opacity-[0.07] overflow-hidden">
              <img
                src={channel.channel_thumbnail_url}
                alt=""
                className="w-full h-full object-cover scale-125 blur-xl"
              />
            </div>
          )}

          <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              {/* Channel Avatar */}
              <div className="relative group/avatar shrink-0">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-[#00D4AA]/40 to-transparent blur-md opacity-50 group-hover/avatar:opacity-100 transition-opacity" />
                {channel.channel_thumbnail_url ? (
                  <img
                    src={channel.channel_thumbnail_url}
                    alt={channel.channel_name}
                    className="relative w-24 h-24 md:w-32 md:h-32 rounded-full object-cover ring-2 ring-white/10 shadow-2xl"
                  />
                ) : (
                  <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full bg-[#1E293B] border border-white/10 flex items-center justify-center text-4xl font-black text-[#00D4AA] font-[family-name:var(--font-geist-mono)]">
                    {channel.channel_name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Identity & Badges */}
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA] text-[11px] font-bold uppercase tracking-wider font-[family-name:var(--font-geist-mono)]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{channel.trust_weight.toFixed(1)}× Trust Tier</span>
                  </div>

                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] font-semibold tracking-wide ${bias.color}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    <span>{bias.label}</span>
                  </div>
                </div>

                <h1 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tight text-[#F1F5F9] font-[family-name:var(--font-geist-mono)]">
                  {channel.channel_name}
                </h1>

                <p className="text-xs md:text-sm text-[#8B95A8] max-w-xl leading-relaxed">
                  {bias.desc} Tracking {videos.length} videos and {allRecs.length} curated stock conviction signals.
                </p>
              </div>
            </div>

            {/* Quick Verdict Chip */}
            <div className="flex flex-col sm:items-end justify-between self-stretch sm:self-auto p-4 rounded-2xl bg-[#0A0F1A]/80 border border-[#1E293B] shrink-0 min-w-[200px]">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#64748B] font-[family-name:var(--font-geist-mono)]">
                Signal Polarity
              </span>
              <div className="my-2">
                <span className={`text-2xl md:text-3xl font-black font-[family-name:var(--font-geist-mono)] ${bias.color}`}>
                  {avgSentiment > 0 ? `+${avgSentiment.toFixed(2)}` : avgSentiment.toFixed(2)}
                </span>
                <span className="text-xs text-[#64748B] ml-1.5 font-bold">score</span>
              </div>
              <span className="text-[11px] text-[#8B95A8] font-[family-name:var(--font-geist-mono)]">
                {Math.round(bullishPct)}% Bullish · {Math.round(bearishPct)}% Bearish
              </span>
            </div>
          </div>

          {/* Integrated Sentiment Gradient Pulse Bar */}
          <div className="mt-8 pt-6 border-t border-white/5 space-y-2">
            <div className="flex justify-between items-center text-xs font-[family-name:var(--font-geist-mono)]">
              <span className="text-[#FF4D6A] font-bold flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5" />
                <span>Bearish: {bearishCount} ({Math.round(bearishPct)}%)</span>
              </span>
              <span className="text-[#8B95A8] font-medium">Neutral: {neutralCount}</span>
              <span className="text-[#00D4AA] font-bold flex items-center gap-1.5">
                <span>Bullish: {bullishCount} ({Math.round(bullishPct)}%)</span>
                <TrendingUp className="w-3.5 h-3.5" />
              </span>
            </div>

            <div className="flex w-full h-3 rounded-full overflow-hidden bg-[#0A0F1A] border border-[#1E293B] shadow-inner p-0.5">
              {bearishCount > 0 && (
                <div
                  className="h-full rounded-l-full bg-gradient-to-r from-[#FF1744] to-[#FF4D6A] transition-all duration-700"
                  style={{ width: `${bearishPct}%` }}
                  title={`Bearish: ${Math.round(bearishPct)}%`}
                />
              )}
              {neutralCount > 0 && (
                <div
                  className="h-full bg-[#475569] transition-all duration-700"
                  style={{ width: `${neutralPct}%` }}
                  title={`Neutral: ${Math.round(neutralPct)}%`}
                />
              )}
              {bullishCount > 0 && (
                <div
                  className="h-full rounded-r-full bg-gradient-to-r from-[#00D4AA] to-[#00FFD0] transition-all duration-700"
                  style={{ width: `${bullishPct}%` }}
                  title={`Bullish: ${Math.round(bullishPct)}%`}
                />
              )}
            </div>
          </div>
        </header>

        {/* ─── 4 Core Performance Indicator Cards ─── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up stagger-2">
          {/* Metric 1: Total Calls */}
          <div className="p-5 rounded-2xl bg-[#141B2D]/50 border border-[#1E293B] hover:border-[#2D3A4F] transition-all group">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#64748B] block mb-2 font-[family-name:var(--font-geist-mono)]">
              Total Recorded Calls
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl md:text-4xl font-black text-[#F1F5F9] font-[family-name:var(--font-geist-mono)]">
                {allRecs.length}
              </span>
              <span className="text-xs text-[#64748B] font-medium">signals</span>
            </div>
            <p className="text-[11px] text-[#8B95A8] mt-2 font-[family-name:var(--font-geist-mono)]">
              Avg {(allRecs.length / Math.max(videos.length, 1)).toFixed(1)} calls / video
            </p>
          </div>

          {/* Metric 2: Conviction Level */}
          <div className="p-5 rounded-2xl bg-[#141B2D]/50 border border-[#1E293B] hover:border-[#00D4AA]/30 transition-all group">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#64748B] block mb-2 font-[family-name:var(--font-geist-mono)]">
              Conviction Calibration
            </span>
            <div className="mb-2">
              <ConvictionMeter level={avgConviction} />
            </div>
            <p className="text-[11px] text-[#8B95A8] font-[family-name:var(--font-geist-mono)]">
              Average analyst confidence index
            </p>
          </div>

          {/* Metric 3: Coverage Breadth */}
          <div className="p-5 rounded-2xl bg-[#141B2D]/50 border border-[#1E293B] hover:border-[#2D3A4F] transition-all group">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#64748B] block mb-2 font-[family-name:var(--font-geist-mono)]">
              Coverage Breadth
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl md:text-4xl font-black text-[#F1F5F9] font-[family-name:var(--font-geist-mono)]">
                {allTickerBreakdowns.length}
              </span>
              <span className="text-xs text-[#64748B] font-medium">unique tickers</span>
            </div>
            <p className="text-[11px] text-[#8B95A8] mt-2 font-[family-name:var(--font-geist-mono)]">
              Across {videos.length} indexed videos
            </p>
          </div>

          {/* Metric 4: Price Target Corridor */}
          <div className="p-5 rounded-2xl bg-[#141B2D]/50 border border-[#1E293B] hover:border-[#2D3A4F] transition-all group">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#64748B] block mb-2 font-[family-name:var(--font-geist-mono)]">
              Price Targets Issued
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl md:text-4xl font-black text-[#F1F5F9] font-[family-name:var(--font-geist-mono)]">
                {priceTargets.length}
              </span>
              <span className="text-xs text-[#64748B] font-medium">targets</span>
            </div>
            <p className="text-[11px] text-[#8B95A8] mt-2 font-[family-name:var(--font-geist-mono)]">
              {priceTargets.length > 0 ? `Avg Target: $${avgTarget?.toFixed(0)}` : 'No price targets given'}
            </p>
          </div>
        </section>

        {/* ─── Ticker Coverage Matrix ─── */}
        <section id="coverage-matrix" className="space-y-5 animate-fade-up stagger-3 scroll-mt-28">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-[#00D4AA]" />
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[#E2E8F0] font-[family-name:var(--font-geist-mono)]">
                  Coverage & Position Conviction
                </h2>
              </div>
              <p className="text-xs text-[#8B95A8]">
                Stocks analyzed and recommended by {channel.channel_name} ranked by frequency and conviction.
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Filters */}
              <div className="flex items-center gap-1 rounded-xl bg-[#141B2D]/60 p-1 border border-[#1E293B]">
                <button
                  onClick={() => {
                    setCoverageFilter('all')
                    setCoverageVisibleCount(8)
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${coverageFilter === 'all' ? 'bg-[#00D4AA]/20 text-[#00D4AA] border border-[#00D4AA]/40' : 'text-[#64748B] hover:text-[#E2E8F0]'}`}
                >
                  All ({allTickerBreakdowns.length})
                </button>
                <button
                  onClick={() => {
                    setCoverageFilter('bullish')
                    setCoverageVisibleCount(8)
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${coverageFilter === 'bullish' ? 'bg-[#00D4AA]/20 text-[#00D4AA] border border-[#00D4AA]/40' : 'text-[#64748B] hover:text-[#00D4AA]'}`}
                >
                  Bullish
                </button>
                <button
                  onClick={() => {
                    setCoverageFilter('bearish')
                    setCoverageVisibleCount(8)
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${coverageFilter === 'bearish' ? 'bg-[#FF4D6A]/20 text-[#FF4D6A] border border-[#FF4D6A]/40' : 'text-[#64748B] hover:text-[#FF4D6A]'}`}
                >
                  Bearish
                </button>
                <button
                  onClick={() => {
                    setCoverageFilter('target')
                    setCoverageVisibleCount(8)
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${coverageFilter === 'target' ? 'bg-white/10 text-[#F1F5F9] border border-white/20' : 'text-[#64748B] hover:text-[#E2E8F0]'}`}
                >
                  With Targets
                </button>
              </div>

              {/* Sort selector */}
              <select
                value={coverageSort}
                onChange={(e) => {
                  setCoverageSort(e.target.value as 'calls' | 'conviction' | 'ticker')
                  setCoverageVisibleCount(8)
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#141B2D] border border-[#1E293B] text-[#8B95A8] focus:text-[#F1F5F9] focus:outline-none focus:border-[#00D4AA]/50 font-[family-name:var(--font-geist-mono)]"
              >
                <option value="calls">Sort by Calls</option>
                <option value="conviction">Sort by Conviction</option>
                <option value="ticker">Sort by Ticker (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Cards Grid */}
          {filteredTickerBreakdowns.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#141B2D]/40 border border-[#1E293B] text-center text-sm text-[#8B95A8]">
              No coverage matches the selected filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayedCoverage.map((b) => (
                <div
                  key={b.ticker}
                  onClick={() => router.push(`/ticker?s=${b.ticker}`)}
                  className="group relative flex flex-col justify-between p-5 rounded-2xl bg-[#141B2D]/40 hover:bg-[#141B2D]/80 border border-[#1E293B] hover:border-[#00D4AA]/40 transition-all duration-300 hover:-translate-y-1 cursor-pointer shadow-lg shadow-black/20"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <span className="font-[family-name:var(--font-geist-mono)] text-2xl font-black text-[#F1F5F9] group-hover:text-[#00D4AA] transition-colors tracking-wide block">
                          {b.ticker}
                        </span>
                        {b.stock_name && (
                          <span className="text-[11px] text-[#64748B] truncate block max-w-[140px]" title={b.stock_name}>
                            {b.stock_name}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className={getSentimentBadgeClass(b.avg_sentiment)}>
                          {getSentimentWord(b.avg_sentiment)}
                        </span>
                        <span className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[#64748B] px-1.5 py-0.5 rounded bg-[#0A0F1A] border border-[#1E293B]">
                          {b.count}× {b.count === 1 ? 'call' : 'calls'}
                        </span>
                      </div>
                    </div>

                    {/* Target Price if present */}
                    {b.avg_target !== null && (
                      <div className="flex items-center gap-1.5 my-2.5 px-2.5 py-1 rounded-lg bg-[#0A0F1A]/80 border border-[#1E293B] font-[family-name:var(--font-geist-mono)] text-xs">
                        <Target className="w-3.5 h-3.5 text-[#00D4AA]" />
                        <span className="text-[#8B95A8]">Avg Target:</span>
                        <span className="text-[#00FFD0] font-bold">${b.avg_target.toFixed(0)}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer with conviction and sentiment history dots */}
                  <div className="pt-3 border-t border-[#1E293B]/60 mt-3 flex items-center justify-between">
                    <MiniConvictionPill level={b.avg_conviction} />

                    {/* Historical trajectory dots */}
                    <div className="flex items-center gap-1" title="Call sentiment timeline">
                      {b.sentiments.slice(-5).map((s, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full ${getSentimentBg(s)}`}
                          title={getSentimentWord(s)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Progressive Disclosure & Pagination Bar for Coverage */}
          {filteredTickerBreakdowns.length > 0 && (
            <div className="p-4 rounded-2xl bg-[#141B2D]/60 border border-white/5 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4 font-[family-name:var(--font-geist-mono)] text-xs">
              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <span className="text-[#8B95A8]">
                  Showing <strong className="text-[#F1F5F9]">{displayedCoverage.length}</strong> of{' '}
                  <strong className="text-[#F1F5F9]">{filteredTickerBreakdowns.length}</strong> positions
                </span>
                <div className="w-full sm:w-32 h-1.5 rounded-full bg-[#0A0F1A] border border-[#1E293B] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#00D4AA] to-[#00FFD0] transition-all duration-300"
                    style={{
                      width: `${(displayedCoverage.length / Math.max(filteredTickerBreakdowns.length, 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {hasMoreCoverage ? (
                  <>
                    <button
                      onClick={() => setCoverageVisibleCount(prev => prev + 8)}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-[#00D4AA]/15 hover:bg-[#00D4AA]/25 text-[#00D4AA] border border-[#00D4AA]/40 font-bold transition-all hover:scale-[1.02] flex items-center justify-center gap-1.5"
                    >
                      <span>Load {Math.min(8, filteredTickerBreakdowns.length - displayedCoverage.length)} More</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setCoverageVisibleCount(filteredTickerBreakdowns.length)}
                      className="px-3 py-2 rounded-xl bg-[#0A0F1A] hover:bg-[#1E293B] text-[#8B95A8] hover:text-[#F1F5F9] border border-[#1E293B] font-medium transition-all"
                    >
                      Show All ({filteredTickerBreakdowns.length})
                    </button>
                  </>
                ) : coverageVisibleCount > 8 ? (
                  <button
                    onClick={() => {
                      setCoverageVisibleCount(8)
                      document.getElementById('coverage-matrix')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                    className="px-4 py-2 rounded-xl bg-[#0A0F1A] hover:bg-[#1E293B] text-[#8B95A8] hover:text-[#F1F5F9] border border-[#1E293B] font-bold transition-all flex items-center gap-1.5"
                  >
                    <span>Collapse to Top</span>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </section>

        {/* ─── Evidence Dossier Feed (Video History) ─── */}
        <section id="video-ledger" className="space-y-6 animate-fade-up stagger-4 scroll-mt-28">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 border-t border-[#1E293B]">
            <div>
              <h2 className="text-xl font-bold text-[#F1F5F9]">
                Video Evidence & Signal Ledger
              </h2>
              <p className="text-xs text-[#8B95A8] mt-0.5">
                {videosWithRecs.length} videos analyzed · newest first
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" />
                <input
                  type="text"
                  placeholder="Filter by ticker or keyword..."
                  value={videoSearch}
                  onChange={(e) => {
                    setVideoSearch(e.target.value)
                    setVideoVisibleCount(viewMode === 'dossier' ? 4 : 10)
                  }}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#141B2D]/80 border border-[#1E293B] text-xs text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#00D4AA]/50 font-[family-name:var(--font-geist-mono)]"
                />
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 rounded-xl bg-[#141B2D] p-1 border border-[#1E293B]">
                <button
                  onClick={() => {
                    setViewMode('dossier')
                    setVideoVisibleCount(4)
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${viewMode === 'dossier' ? 'bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/30' : 'text-[#64748B] hover:text-[#E2E8F0]'}`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Dossier</span>
                </button>
                <button
                  onClick={() => {
                    setViewMode('terminal')
                    setVideoVisibleCount(10)
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${viewMode === 'terminal' ? 'bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/30' : 'text-[#64748B] hover:text-[#E2E8F0]'}`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Terminal</span>
                </button>
              </div>
            </div>
          </div>

          {/* Videos List / Dossier */}
          {videosWithRecs.length === 0 ? (
            <div className="p-10 rounded-2xl bg-[#141B2D]/30 border border-[#1E293B] text-center text-sm text-[#8B95A8]">
              No videos match your search query.
            </div>
          ) : viewMode === 'dossier' ? (
            /* ─── DOSSIER VIEW ─── */
            <div className="space-y-6">
              {displayedVideos.map((video) => (
                <div
                  key={video.video_id}
                  className="rounded-3xl border border-[#1E293B] bg-[#141B2D]/40 overflow-hidden hover:border-[#2D3A4F] transition-all shadow-xl shadow-black/20"
                >
                  {/* Video Header Card */}
                  <div className="p-5 md:p-6 bg-[#141B2D]/80 border-b border-[#1E293B]/60 flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div className="flex items-start sm:items-center gap-4 min-w-0">
                      {/* Video Thumbnail */}
                      <div
                        onClick={() => router.push(`/video?id=${video.youtube_video_id}`)}
                        className="group/thumb relative rounded-xl overflow-hidden w-28 h-16 md:w-36 md:h-20 bg-[#0A0F1A] shrink-0 border border-[#1E293B] hover:border-[#00D4AA]/50 cursor-pointer transition-all"
                      >
                        <img
                          src={getYoutubeThumbnail(video.youtube_video_id)}
                          alt=""
                          className="w-full h-full object-cover opacity-80 group-hover/thumb:opacity-100 group-hover/thumb:scale-105 transition-all duration-300"
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <div className="w-7 h-7 rounded-full bg-[#0A0F1A]/80 flex items-center justify-center text-[#F1F5F9] group-hover/thumb:text-[#00D4AA] group-hover/thumb:scale-110 transition-all">
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          </div>
                        </div>
                        {video.duration && (
                          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono text-white">
                            {formatDuration(video.duration)}
                          </div>
                        )}
                      </div>

                      {/* Video Title & Meta */}
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-[family-name:var(--font-geist-mono)] text-[#64748B] block mb-1">
                          {formatDate(video.published_at)} ({formatRelativeTime(video.published_at)})
                        </span>
                        <h3
                          onClick={() => router.push(`/video?id=${video.youtube_video_id}`)}
                          className="text-base md:text-lg font-bold text-[#F1F5F9] hover:text-[#00D4AA] transition-colors cursor-pointer line-clamp-2"
                        >
                          {video.title || 'Untitled Financial Briefing'}
                        </h3>
                        {video.video_summary && (
                          <p className="text-xs text-[#8B95A8] line-clamp-1 mt-1 font-light">
                            {video.video_summary}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Quick Link Buttons */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <button
                        onClick={() => router.push(`/video?id=${video.youtube_video_id}`)}
                        className="px-3 py-1.5 rounded-lg bg-[#00D4AA]/10 hover:bg-[#00D4AA]/20 border border-[#00D4AA]/30 text-xs font-semibold text-[#00D4AA] transition-all"
                      >
                        Inspect Breakdown →
                      </button>
                      <a
                        href={video.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-[#1E293B]/60 hover:bg-[#1E293B] text-[#8B95A8] hover:text-[#F1F5F9] transition-colors"
                        title="Watch on YouTube"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  {/* Recommendations Dossier inside Video */}
                  <div className="p-5 md:p-6 space-y-3 bg-[#0A0F1A]/40">
                    <div className="text-[10px] uppercase font-bold tracking-widest text-[#64748B] mb-2 font-[family-name:var(--font-geist-mono)]">
                      Extracted Stock Calls ({video.recommendations.length})
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {video.recommendations.map((rec) => (
                        <div
                          key={rec.id}
                          className="p-4 rounded-2xl bg-[#141B2D]/70 border border-[#1E293B] hover:border-[#00D4AA]/30 transition-all flex flex-col justify-between gap-3 group/rec"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div
                                onClick={() => router.push(`/ticker?s=${rec.ticker}`)}
                                className="cursor-pointer"
                              >
                                <span className="font-[family-name:var(--font-geist-mono)] text-xl font-black text-[#F1F5F9] group-hover/rec:text-[#00D4AA] transition-colors">
                                  {rec.ticker}
                                </span>
                                {rec.stock_name && (
                                  <span className="text-[11px] text-[#64748B] block truncate max-w-[140px]">
                                    {rec.stock_name}
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-col items-end gap-1">
                                <span className={getSentimentBadgeClass(rec.sentiment)}>
                                  {getSentimentWord(rec.sentiment)}
                                </span>
                                {rec.target_price !== null && (
                                  <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[#00FFD0] font-bold">
                                    Target: ${rec.target_price.toFixed(0)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Catalyst Quote Box */}
                            {rec.catalyst_notes && (
                              <blockquote className="text-xs text-[#8B95A8] bg-[#0A0F1A]/60 p-3 rounded-xl border border-white/5 leading-relaxed italic relative">
                                &ldquo;{rec.catalyst_notes}&rdquo;
                              </blockquote>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs font-[family-name:var(--font-geist-mono)]">
                            <span className="text-[11px] text-[#64748B]">
                              Conviction: <strong className="text-[#F1F5F9]">{rec.conviction_level}/10</strong>
                            </span>
                            <button
                              onClick={() => router.push(`/ticker?s=${rec.ticker}`)}
                              className="text-[11px] text-[#00D4AA] hover:text-[#00FFD0] font-bold inline-flex items-center gap-1 group-hover/rec:translate-x-0.5 transition-transform"
                            >
                              <span>Consensus Signal</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ─── TERMINAL TABLE VIEW ─── */
            <div className="rounded-2xl border border-[#1E293B] bg-[#141B2D]/50 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-[family-name:var(--font-geist-mono)]">
                <thead>
                  <tr className="border-b border-[#1E293B] bg-[#0A0F1A]/80 text-[#64748B] uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Ticker</th>
                    <th className="py-3 px-4">Sentiment</th>
                    <th className="py-3 px-4">Target</th>
                    <th className="py-3 px-4">Conviction</th>
                    <th className="py-3 px-4">Catalyst Notes</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]/50 text-[#C8D1DE]">
                  {displayedVideos.flatMap((v) =>
                    v.recommendations.map((r) => (
                      <tr key={r.id} className="hover:bg-[#141B2D]/80 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap text-[#8B95A8]">
                          {formatDate(v.published_at)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <Link
                            href={`/ticker?s=${r.ticker}`}
                            className="text-[#F1F5F9] font-black hover:text-[#00D4AA] transition-colors"
                          >
                            {r.ticker}
                          </Link>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={getSentimentBadgeClass(r.sentiment)}>
                            {getSentimentWord(r.sentiment)}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-[#00FFD0] font-bold">
                          {r.target_price !== null ? `$${r.target_price.toFixed(0)}` : '—'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-[#8B95A8]">
                          {r.conviction_level}/10
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-[#8B95A8] font-sans" title={r.catalyst_notes}>
                          {r.catalyst_notes || '—'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-right space-x-2">
                          <Link
                            href={`/video?id=${v.youtube_video_id}`}
                            className="text-[#00D4AA] hover:underline"
                          >
                            Video
                          </Link>
                          <span className="text-[#334155]">·</span>
                          <Link
                            href={`/ticker?s=${r.ticker}`}
                            className="text-[#00D4AA] hover:underline"
                          >
                            Signal
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Progressive Disclosure & Pagination Bar for Videos */}
          {videosWithRecs.length > 0 && (
            <div className="p-4 rounded-2xl bg-[#141B2D]/60 border border-white/5 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4 font-[family-name:var(--font-geist-mono)] text-xs">
              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <span className="text-[#8B95A8]">
                  Showing <strong className="text-[#F1F5F9]">{displayedVideos.length}</strong> of{' '}
                  <strong className="text-[#F1F5F9]">{videosWithRecs.length}</strong> indexed videos
                </span>
                <div className="w-full sm:w-32 h-1.5 rounded-full bg-[#0A0F1A] border border-[#1E293B] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#00D4AA] to-[#00FFD0] transition-all duration-300"
                    style={{
                      width: `${(displayedVideos.length / Math.max(videosWithRecs.length, 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {hasMoreVideos ? (
                  <>
                    <button
                      onClick={() => setVideoVisibleCount(prev => prev + (viewMode === 'terminal' ? 10 : 4))}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-[#00D4AA]/15 hover:bg-[#00D4AA]/25 text-[#00D4AA] border border-[#00D4AA]/40 font-bold transition-all hover:scale-[1.02] flex items-center justify-center gap-1.5"
                    >
                      <span>Load {Math.min(viewMode === 'terminal' ? 10 : 4, videosWithRecs.length - displayedVideos.length)} More</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setVideoVisibleCount(videosWithRecs.length)}
                      className="px-3 py-2 rounded-xl bg-[#0A0F1A] hover:bg-[#1E293B] text-[#8B95A8] hover:text-[#F1F5F9] border border-[#1E293B] font-medium transition-all"
                    >
                      Show All ({videosWithRecs.length})
                    </button>
                  </>
                ) : videoVisibleCount > (viewMode === 'terminal' ? 10 : 4) ? (
                  <button
                    onClick={() => {
                      setVideoVisibleCount(viewMode === 'terminal' ? 10 : 4)
                      document.getElementById('video-ledger')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                    className="px-4 py-2 rounded-xl bg-[#0A0F1A] hover:bg-[#1E293B] text-[#8B95A8] hover:text-[#F1F5F9] border border-[#1E293B] font-bold transition-all flex items-center gap-1.5"
                  >
                    <span>Collapse to Recent</span>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </section>

      </div>
    </div>
  )
}

export default function ChannelDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0A0F1A]">
        <div className="w-8 h-8 rounded-full border-2 border-[#1E293B] border-t-[#00D4AA] animate-spin" />
      </div>
    }>
      <ChannelContent />
    </Suspense>
  )
}
