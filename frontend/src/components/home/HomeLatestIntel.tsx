'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils'
import { ArrowRight, Play, Radio } from 'lucide-react'

interface VideoDrop {
  video_id: string
  youtube_video_id: string
  title: string | null
  published_at: string
  channel_id: string
  channel_name: string
  trust_weight: number
  channel_thumbnail_url: string | null
  tickers: { ticker: string; sentiment: number }[]
}

interface RawVideoRow {
  video_id: string
  youtube_video_id: string
  title: string | null
  published_at: string
  channel_id: string
  channels: {
    channel_id?: string
    channel_name?: string
    trust_weight?: number
    channel_thumbnail_url?: string | null
  } | null
}

const AVATAR_COLORS = ['#00D4AA', '#7C3AED', '#F59E0B', '#3B82F6', '#EC4899', '#10B981']

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export default function HomeLatestIntel() {
  const [drops, setDrops] = useState<VideoDrop[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function fetchLatestIntel() {
      try {
        const supabase = createClient()

        // 1. Fetch top 3 latest videos with channel details
        const { data: videosData, error: vErr } = await supabase
          .from('videos')
          .select(`
            video_id,
            youtube_video_id,
            title,
            published_at,
            channel_id,
            channels (
              channel_id,
              channel_name,
              trust_weight,
              channel_thumbnail_url
            )
          `)
          .order('published_at', { ascending: false })
          .limit(3)

        if (vErr || !videosData || videosData.length === 0) {
          if (active) setLoading(false)
          return
        }

        const videoRows = videosData as unknown as RawVideoRow[]
        const videoIds = videoRows.map((v) => v.video_id)

        // 2. Fetch recommendations for these 3 videos
        const { data: recsData } = await supabase
          .from('recommendations')
          .select('video_id, ticker, sentiment')
          .in('video_id', videoIds)

        const recsByVideo = new Map<string, { ticker: string; sentiment: number }[]>()
        if (recsData) {
          for (const r of recsData) {
            const list = recsByVideo.get(r.video_id) || []
            list.push({ ticker: r.ticker, sentiment: r.sentiment })
            recsByVideo.set(r.video_id, list)
          }
        }

        const formatted: VideoDrop[] = videoRows.map((v) => {
          const ch = v.channels || {}
          return {
            video_id: v.video_id,
            youtube_video_id: v.youtube_video_id,
            title: v.title || 'Market Analysis & Stock Breakdown',
            published_at: v.published_at,
            channel_id: ch.channel_id || v.channel_id,
            channel_name: ch.channel_name || 'Verified Analyst',
            trust_weight: ch.trust_weight || 1.0,
            channel_thumbnail_url: ch.channel_thumbnail_url || null,
            tickers: recsByVideo.get(v.video_id) || [],
          }
        })

        if (active) {
          setDrops(formatted)
          setLoading(false)
        }
      } catch (err) {
        console.error('Failed to load latest intel:', err)
        if (active) setLoading(false)
      }
    }

    fetchLatestIntel()
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div className="mb-8 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-[#1E293B]" />
            <div className="h-3.5 w-36 bg-[#1E293B] rounded" />
          </div>
          <div className="h-3 w-20 bg-[#1E293B]/60 rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-5 rounded-2xl bg-[#141B2D]/40 border border-[#1E293B]/60 min-h-[170px] flex flex-col justify-between"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#1E293B]" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 w-24 bg-[#1E293B] rounded" />
                  <div className="h-2.5 w-16 bg-[#1E293B]/60 rounded" />
                </div>
              </div>
              <div className="h-3 w-full bg-[#1E293B]/60 rounded mb-2" />
              <div className="h-5 w-32 bg-[#1E293B]/40 rounded mt-auto" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (drops.length === 0) return null

  return (
    <section className="mb-8 animate-fade-up">
      {/* Section Header */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-[#00D4AA] animate-pulse" />
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#E2E8F0] font-[family-name:var(--font-geist-mono)]">
            Fresh Analyst Drops
          </h2>
          <span className="hidden sm:inline-flex items-center text-[10px] font-bold text-[#00D4AA] bg-[#00D4AA]/10 border border-[#00D4AA]/25 px-2 py-0.5 rounded-full font-[family-name:var(--font-geist-mono)]">
            ● LIVE YOUTUBE INTEL
          </span>
        </div>

        <Link
          href="/videos"
          className="text-xs text-[#00D4AA] hover:text-[#00FFD0] font-semibold tracking-wide flex items-center gap-1 transition-colors group/link font-[family-name:var(--font-geist-mono)]"
        >
          <span>All Video Dossiers</span>
          <ArrowRight className="w-3.5 h-3.5 transform group-link:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* 3-Column Video Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {drops.map((drop) => {
          const avatarBg = getAvatarColor(drop.channel_name)

          return (
            <Link
              key={drop.video_id}
              href={`/video?id=${drop.youtube_video_id}`}
              className="group relative flex flex-col justify-between p-5 rounded-2xl bg-[#141B2D]/40 backdrop-blur-md border border-[#1E293B]/70 hover:border-[#00D4AA]/40 hover:bg-[#141B2D]/70 transition-all duration-300 ease-out hover:-translate-y-1 shadow-lg shadow-black/20 overflow-hidden"
            >
              {/* Subtle hover radial glow */}
              <div className="absolute -inset-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(ellipse_at_top_right,rgba(0,212,170,0.08),transparent_70%)] pointer-events-none" />

              <div>
                {/* Channel Header with Avatar and Timestamp */}
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      {drop.channel_thumbnail_url ? (
                        <img
                          src={drop.channel_thumbnail_url}
                          alt=""
                          className="w-9 h-9 rounded-xl object-cover border border-[#1E293B] group-hover:border-[#00D4AA]/40 transition-colors"
                        />
                      ) : (
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-xs border border-white/10"
                          style={{ backgroundColor: avatarBg }}
                        >
                          {drop.channel_name.charAt(0)}
                        </div>
                      )}
                      <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#0A0F1A] border border-[#1E293B] flex items-center justify-center">
                        <Play className="w-1.5 h-1.5 text-[#00D4AA] fill-[#00D4AA]" />
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#F1F5F9] group-hover:text-[#00D4AA] transition-colors truncate">
                          {drop.channel_name}
                        </span>
                        {drop.trust_weight > 1.0 && (
                          <span
                            title="High Trust Channel"
                            className="shrink-0 inline-flex items-center text-[9px] text-[#00FFD0] bg-[#00FFD0]/10 border border-[#00FFD0]/25 px-1 py-0.2 rounded font-[family-name:var(--font-geist-mono)]"
                          >
                            {drop.trust_weight}x
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#64748B] font-[family-name:var(--font-geist-mono)] block">
                        {formatRelativeTime(drop.published_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Video Title */}
                <h3 className="text-xs font-medium text-[#CBD5E1] group-hover:text-[#F1F5F9] transition-colors line-clamp-2 leading-relaxed mb-3">
                  {drop.title}
                </h3>
              </div>

              {/* Extracted Tickers Footer */}
              <div className="pt-3 border-t border-[#1E293B]/60 flex items-center justify-between gap-2 text-xs">
                {drop.tickers.length > 0 ? (
                  <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                    {drop.tickers.slice(0, 3).map((t, idx) => {
                      const isBull = t.sentiment > 0
                      const isBear = t.sentiment < 0
                      return (
                        <span
                          key={`${t.ticker}-${idx}`}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#0A0F1A]/80 border border-[#1E293B] text-[10px] font-bold font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isBull ? 'bg-[#00D4AA]' : isBear ? 'bg-[#FF4D6A]' : 'bg-[#64748B]'
                            }`}
                          />
                          <span>{t.ticker}</span>
                        </span>
                      )
                    })}
                    {drop.tickers.length > 3 && (
                      <span className="text-[9px] text-[#64748B] font-[family-name:var(--font-geist-mono)]">
                        +{drop.tickers.length - 3}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] text-[#64748B] font-[family-name:var(--font-geist-mono)]">
                    Macro commentary
                  </span>
                )}

                <span className="text-[10px] text-[#8B95A8] group-hover:text-[#00D4AA] font-bold font-[family-name:var(--font-geist-mono)] shrink-0 flex items-center gap-0.5 transition-colors">
                  <span>Dossier</span>
                  <span>→</span>
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
