'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface ChannelData {
  channel_id: string
  channel_name: string
  trust_weight: number
  created_at: string
}

interface VideoData {
  video_id: string
  channel_id: string
  video_url: string
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
  created_at: string
  total_videos: number
  total_recommendations: number
  avg_sentiment: number
  avg_conviction: number
  top_tickers: string[]
  latest_video_date: string | null
  bullish_pct: number
  bearish_pct: number
}

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

    const latestVideo = chVideos.length > 0
      ? chVideos.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())[0]
      : null

    return {
      channel_id: ch.channel_id,
      channel_name: ch.channel_name,
      trust_weight: ch.trust_weight,
      created_at: ch.created_at,
      total_videos: chVideos.length,
      total_recommendations: chRecs.length,
      avg_sentiment: avgSentiment,
      avg_conviction: avgConviction,
      top_tickers: topTickers,
      latest_video_date: latestVideo?.published_at || null,
      bullish_pct: (bullish / total) * 100,
      bearish_pct: (bearish / total) * 100,
    }
  }).sort((a, b) => b.total_recommendations - a.total_recommendations)
}

function getBiasLabel(avgSentiment: number, bullishPct: number): { label: string; isStrong: boolean } {
  if (bullishPct >= 80) return { label: 'Very Bullish', isStrong: true }
  if (avgSentiment >= 0.5 || bullishPct >= 60) return { label: 'Mostly Bullish', isStrong: false }
  if (avgSentiment <= -0.5 || bullishPct <= 20) return { label: 'Mostly Bearish', isStrong: avgSentiment <= -1 }
  return { label: 'Mixed', isStrong: false }
}

function TrustMeter({ weight }: { weight: number }) {
  // Trust weight is typically 0.5 to 2.0, normalize to 0-100
  const normalized = Math.min(Math.max((weight - 0.5) / 1.5, 0), 1) * 100

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-16 h-1.5 rounded-full bg-[#1E293B] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[#00D4AA] pulse-bar-fill"
          style={{ width: `${normalized}%` }}
        />
      </div>
      <span className="font-[family-name:var(--font-geist-mono)] text-[11px] text-[#64748B]">
        {weight.toFixed(1)}×
      </span>
    </div>
  )
}

function SentimentSplit({ bullish, bearish }: { bullish: number; bearish: number }) {
  const neutral = 100 - bullish - bearish

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex w-20 h-1.5 rounded-full overflow-hidden bg-[#1E293B]">
        {bullish > 0 && (
          <div
            className="h-full bg-[#00D4AA]"
            style={{ width: `${bullish}%` }}
          />
        )}
        {neutral > 0 && (
          <div
            className="h-full bg-[#2D3A4F]"
            style={{ width: `${neutral}%` }}
          />
        )}
        {bearish > 0 && (
          <div
            className="h-full bg-[#FF4D6A]"
            style={{ width: `${bearish}%` }}
          />
        )}
      </div>
      <span className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[#64748B]">
        {bullish.toFixed(0)}% bull
      </span>
    </div>
  )
}

function ChannelCard({ profile, index }: { profile: ChannelProfile; index: number }) {
  const staggerClass = `stagger-${Math.min(index + 1, 10)}`
  const isTopChannel = index === 0 && profile.total_recommendations >= 3

  return (
    <div
      className={`
        group relative rounded-2xl border p-6 md:p-8 transition-all duration-300
        ${isTopChannel
          ? 'border-[#00D4AA]/20 bg-[#141B2D] animate-glow'
          : 'border-[#1E293B] bg-[#141B2D]/50 hover:border-[#2D3A4F] hover:bg-[#141B2D]'
        }
        animate-fade-up ${staggerClass}
      `}
    >
      {/* Top: Channel identity */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <Link
            href={`/channel?id=${profile.channel_id}`}
            className="inline-flex items-center gap-2 font-[family-name:var(--font-geist-mono)] text-xl md:text-2xl font-bold text-[#F1F5F9] tracking-tight group-hover:text-[#00D4AA] transition-colors duration-300 group/channel"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[#475569] group-hover:text-[#00D4AA] transition-colors shrink-0" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="group-hover:underline decoration-[#00D4AA]/30 underline-offset-4 truncate">
              {profile.channel_name}
            </span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-[#475569] group-hover:text-[#00D4AA] transition-all group-hover:translate-x-0.5 shrink-0 opacity-0 group-hover:opacity-100" aria-hidden="true">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <div className="mt-1.5 flex items-center flex-wrap gap-x-3 gap-y-1">
            <span className="text-xs text-[#64748B]">
              {profile.total_videos} video{profile.total_videos !== 1 ? 's' : ''}
            </span>
            <span className="text-[#1E293B]" aria-hidden="true">·</span>
            <span className="text-xs text-[#64748B]">
              {profile.total_recommendations} rec{profile.total_recommendations !== 1 ? 's' : ''}
            </span>
            {profile.latest_video_date && (
              <>
                <span className="text-[#1E293B]" aria-hidden="true">·</span>
                <span className="text-xs text-[#64748B]">
                  Latest {new Date(profile.latest_video_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Trust badge */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] uppercase tracking-[0.15em] text-[#475569]">Trust</span>
          <TrustMeter weight={profile.trust_weight} />
        </div>
      </div>

      {/* Middle: The signal — bias label + split bar */}
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <span className="text-[10px] uppercase tracking-[0.15em] text-[#475569] block mb-1">Lean</span>
          {(() => {
            const bias = getBiasLabel(profile.avg_sentiment, profile.bullish_pct)
            return (
              <span className={`text-2xl md:text-3xl font-semibold tracking-tight ${
                profile.avg_sentiment >= 0.5
                  ? (bias.isStrong ? 'sentiment-strong-buy' : 'text-[#00D4AA]')
                  : profile.avg_sentiment <= -0.5
                    ? (bias.isStrong ? 'sentiment-strong-sell' : 'text-[#FF4D6A]')
                    : 'text-[#8B95A8]'
              }`}>
                {bias.label}
              </span>
            )
          })()}
          <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[#475569] ml-2">
            {Math.round(profile.bullish_pct)}% of calls are bullish
          </span>
        </div>
        <div className="flex flex-col items-end gap-2">
          <SentimentSplit bullish={profile.bullish_pct} bearish={profile.bearish_pct} />
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#475569]">Conviction</span>
            <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[#8B95A8]">
              {profile.avg_conviction.toFixed(1)}<span className="text-[#475569]">/10</span>
            </span>
          </div>
        </div>
      </div>

      {/* Bottom: Top tickers as interactive pills */}
      {profile.top_tickers.length > 0 && (
        <div className="flex items-center flex-wrap gap-2 pt-4 border-t border-[#1E293B]/60">
          {profile.top_tickers.map((ticker) => (
            <Link
              key={ticker}
              href={`/ticker?s=${ticker}`}
              className="font-[family-name:var(--font-geist-mono)] text-xs font-medium px-2.5 py-1 rounded-md bg-[#0A0F1A] border border-[#1E293B] text-[#8B95A8] hover:text-[#00D4AA] hover:border-[#00D4AA]/30 transition-all duration-200"
            >
              {ticker}
            </Link>
          ))}
        </div>
      )}

      {/* Glow accent for top channel */}
      {isTopChannel && (
        <div
          className="absolute -inset-px rounded-2xl pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at top, rgba(0,212,170,0.04) 0%, transparent 60%)',
          }}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

export default function ChannelsPage() {
  const [profiles, setProfiles] = useState<ChannelProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()

      const [channelsRes, videosRes, recsRes] = await Promise.all([
        supabase.from('channels').select('channel_id, channel_name, trust_weight, created_at'),
        supabase.from('videos').select('video_id, channel_id, video_url, published_at'),
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
              Loading analyst profiles…
            </p>
          </div>
        </div>
      </div>
    )
  }

  const totalRecs = profiles.reduce((s, p) => s + p.total_recommendations, 0)
  const totalVideos = profiles.reduce((s, p) => s + p.total_videos, 0)

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        {/* Nav */}
        <Link
          href="/"
          className="inline-block text-xl font-extralight tracking-[0.2em] logo-sweep hover:opacity-80 transition-opacity animate-fade-up"
        >
          <span className="logo-letter">Aura</span>
        </Link>

        {/* Page header */}
        <header className="mt-12 mb-4 animate-fade-up stagger-1">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-[#F1F5F9]">
            The Analysts
          </h1>
          <p className="mt-3 text-lg text-[#8B95A8] font-light max-w-lg">
            Every channel tracked by Aura. Their signal, their conviction, their coverage.
          </p>
        </header>

        {/* Aggregate stats strip */}
        <div className="flex items-center gap-4 mb-12 animate-fade-up stagger-2">
          <div className="font-[family-name:var(--font-geist-mono)] text-xs text-[#64748B] tracking-wide flex items-center gap-3">
            <span><span className="text-[#8B95A8]">{profiles.length}</span> channels</span>
            <span className="text-[#1E293B]">·</span>
            <span><span className="text-[#8B95A8]">{totalVideos}</span> videos</span>
            <span className="text-[#1E293B]">·</span>
            <span><span className="text-[#8B95A8]">{totalRecs}</span> recommendations</span>
          </div>
        </div>

        {/* Pulse line separator */}
        <div className="relative h-px mb-10 animate-fade-up stagger-2">
          <div className="absolute inset-0 bg-[#1E293B]" />
          <div className="absolute inset-0 h-px bg-gradient-to-r from-transparent via-[#00D4AA] to-transparent hero-pulse-line" />
        </div>

        {/* Channel cards */}
        {profiles.length === 0 ? (
          <div className="rounded-xl border border-[#1E293B] bg-[#141B2D]/40 p-12 text-center animate-fade-up">
            <p className="text-lg text-[#8B95A8]">No channels yet.</p>
            <p className="mt-2 text-sm text-[#64748B]">
              Channels appear once a video is ingested.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {profiles.map((profile, index) => (
              <ChannelCard key={profile.channel_id} profile={profile} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
