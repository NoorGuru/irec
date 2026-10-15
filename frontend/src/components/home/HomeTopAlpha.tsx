'use client'

import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Flame,
  ShieldCheck,
  Target,
  ArrowRight,
  Sparkles,
  ChevronRight,
  X,
  ExternalLink,
  Activity,
} from 'lucide-react'

import { Play, TopAlphaPlay, InvestorArchetype } from '@/lib/types'
import { filterTopBuyPlays } from '@/lib/alpha-ranking'
import { normalizeAvgConviction100, formatRelativeTime } from '@/lib/utils'

export interface HomeTopAlphaProps {
  plays: Play[]
  loading?: boolean
}

const ARCHETYPES: { key: InvestorArchetype; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'all', label: 'All Top Picks', icon: Sparkles, color: 'text-[#00D4AA]' },
  { key: 'core', label: 'Core Pillars', icon: ShieldCheck, color: 'text-[#00D4AA]' },
  { key: 'growth', label: 'Growth Momentum', icon: Flame, color: 'text-[#F59E0B]' },
  { key: 'value', label: 'Target Upside', icon: Target, color: 'text-[#38BDF8]' },
]

export function HomeTopAlphaSkeleton() {
  return (
    <section className="relative rounded-3xl border border-[#1E293B]/60 bg-[#141B2D]/40 overflow-hidden mb-10 p-6 md:p-8 animate-pulse">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="space-y-2">
          <div className="h-4 w-40 bg-[#1E293B] rounded-lg" />
          <div className="h-7 w-64 bg-[#1E293B] rounded-xl" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-[#1E293B] rounded-xl" />
          <div className="h-9 w-28 bg-[#1E293B] rounded-xl" />
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 bg-[#0A0F1A]/80 border border-[#1E293B] rounded-2xl" />
        ))}
      </div>
    </section>
  )
}

export default function HomeTopAlpha({ plays, loading = false }: HomeTopAlphaProps) {
  const router = useRouter()
  const [limit, setLimit] = useState<number>(5)
  const [selectedArchetype, setSelectedArchetype] = useState<InvestorArchetype>('all')
  const [inspectedPlay, setInspectedPlay] = useState<TopAlphaPlay | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // Filter top buys using deterministic quantitative engine
  const topBuys = useMemo(() => {
    return filterTopBuyPlays(plays, limit, selectedArchetype)
  }, [plays, limit, selectedArchetype])

  if (loading && plays.length === 0) {
    return <HomeTopAlphaSkeleton />
  }

  if (!loading && topBuys.length === 0) {
    return null
  }

  return (
    <section
      ref={cardRef}
      id="top-buys-now"
      className="group relative rounded-3xl border border-[#1E293B] bg-[#141B2D]/55 backdrop-blur-md overflow-hidden mb-10 p-5 sm:p-6 md:p-8 transition-all duration-500 shadow-2xl shadow-black/40 animate-fade-up"
    >
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-1/3 w-[350px] h-[350px] rounded-full blur-[130px] pointer-events-none bg-gradient-to-br from-[#00D4AA]/10 via-[#00FFD0]/5 to-transparent opacity-60" />

      {/* Header Bar */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-6 border-b border-[#1E293B]/80">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D4AA] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00D4AA]" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#00D4AA] font-[family-name:var(--font-geist-mono)]">
              Executive Conviction Radar
            </span>
            <span className="text-[#334155]">•</span>
            <span className="text-[10px] font-bold text-[#8B95A8] uppercase tracking-wider font-[family-name:var(--font-geist-mono)]">
              30-Day Video Consensus
            </span>
          </div>

          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#F1F5F9] tracking-tight">
              Top Stocks to Buy Now
            </h2>
            <span className="text-xs text-[#8B95A8] font-normal">
              Filtered by strict multi-channel consensus &amp; conviction
            </span>
          </div>
        </div>

        {/* View Controls: Archetype Filter Pills & 5 vs 10 Toggle */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Archetype Pills */}
          <div className="flex items-center p-1 bg-[#0A0F1A]/80 border border-[#1E293B] rounded-xl overflow-x-auto hide-scrollbar">
            {ARCHETYPES.map((tab) => {
              const Icon = tab.icon
              const isActive = selectedArchetype === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedArchetype(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 whitespace-nowrap ${
                    isActive
                      ? 'bg-[#1E293B] text-[#F1F5F9] shadow-inner border border-white/10'
                      : 'text-[#8B95A8] hover:text-[#F1F5F9]'
                  }`}
                >
                  <Icon className={`w-3 h-3 ${isActive ? tab.color : 'text-[#64748B]'}`} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* 5 vs 10 Switcher */}
          <div className="flex items-center p-1 bg-[#0A0F1A]/80 border border-[#1E293B] rounded-xl font-[family-name:var(--font-geist-mono)] text-xs">
            <button
              type="button"
              onClick={() => setLimit(5)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all duration-200 ${
                limit === 5
                  ? 'bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/30'
                  : 'text-[#8B95A8] hover:text-[#F1F5F9]'
              }`}
            >
              Top 5
            </button>
            <button
              type="button"
              onClick={() => setLimit(10)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all duration-200 ${
                limit === 10
                  ? 'bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/30'
                  : 'text-[#8B95A8] hover:text-[#F1F5F9]'
              }`}
            >
              Top 10
            </button>
          </div>
        </div>
      </div>

      {/* Leaderboard Stack */}
      <div className="relative z-10 mt-5 space-y-3">
        {topBuys.map((play) => {
          const isTop1 = play.rank === 1
          const convictionVal = Math.round(normalizeAvgConviction100(play.avg_conviction))

          return (
            <div
              key={play.ticker}
              onClick={() => setInspectedPlay(play)}
              className={`group/row relative flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:p-5 rounded-2xl bg-[#0A0F1A]/75 border transition-all duration-300 cursor-pointer overflow-hidden ${
                isTop1
                  ? 'border-[#00D4AA]/40 shadow-[0_0_20px_rgba(0,212,170,0.12)] hover:border-[#00D4AA]/70 hover:shadow-[0_0_30px_rgba(0,212,170,0.22)]'
                  : 'border-[#1E293B]/70 hover:border-[#00D4AA]/35 hover:bg-[#141B2D]/80'
              } hover:-translate-y-0.5`}
            >
              {/* Top 1 Signature Glow Accents */}
              {isTop1 && (
                <div className="absolute top-0 right-0 px-3 py-0.5 rounded-bl-xl bg-[#00D4AA]/15 border-b border-l border-[#00D4AA]/30 text-[9px] font-black uppercase tracking-widest text-[#00D4AA] font-[family-name:var(--font-geist-mono)]">
                  ★ #1 Conviction Anchor
                </div>
              )}

              {/* Left Column: Rank + Ticker + Company Name + Archetype Badge */}
              <div className="flex items-start sm:items-center gap-3.5 min-w-[220px] lg:min-w-[260px]">
                {/* Oversized Geist Mono Rank */}
                <span
                  className={`font-[family-name:var(--font-geist-mono)] text-2xl md:text-3xl font-black tracking-tighter shrink-0 w-10 ${
                    isTop1 ? 'text-[#00FFD0]' : 'text-[#64748B]'
                  }`}
                >
                  {String(play.rank).padStart(2, '0')}
                </span>

                <div className="flex flex-col">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-[family-name:var(--font-geist-mono)] text-xl md:text-2xl font-black text-[#F1F5F9] tracking-wide group-hover/row:text-[#00D4AA] transition-colors">
                      {play.ticker}
                    </span>

                    {/* Aura Score Pill */}
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black font-[family-name:var(--font-geist-mono)] bg-[#00D4AA]/10 text-[#00D4AA] border border-[#00D4AA]/25">
                      AURA {play.aura_score}
                    </span>

                    {/* Archetype Badge */}
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase font-[family-name:var(--font-geist-mono)] border ${
                        play.archetype === 'core'
                          ? 'bg-[#00D4AA]/10 text-[#00D4AA] border-[#00D4AA]/20'
                          : play.archetype === 'growth'
                          ? 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20'
                          : 'bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]/20'
                      }`}
                    >
                      {play.archetype_label}
                    </span>
                  </div>

                  <span className="text-xs text-[#8B95A8] font-medium truncate max-w-[200px] mt-0.5">
                    {play.stock_name}
                  </span>
                </div>
              </div>

              {/* Center Column: Executive Thesis Punchline */}
              <div className="flex-1 md:px-2">
                <p className="text-xs md:text-sm text-[#E2E8F0] font-normal leading-relaxed line-clamp-2">
                  {play.executive_thesis}
                </p>
              </div>

              {/* Right Column: Key Proof Metrics & Action Arrow */}
              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 font-[family-name:var(--font-geist-mono)] pt-2 md:pt-0 border-t md:border-t-0 border-[#1E293B]">
                {/* Consensus Metrics */}
                <div className="flex items-center gap-3">
                  {/* Channels & Agreement */}
                  <div className="flex flex-col sm:items-end">
                    <span className="text-xs font-black text-[#00D4AA]">
                      {play.agreement_pct}% Agreement
                    </span>
                    <span className="text-[10px] text-[#8B95A8]">
                      {play.analyst_count} {play.analyst_count === 1 ? 'channel' : 'channels'}
                    </span>
                  </div>

                  {/* Target Price if present */}
                  {play.avg_target_price && (
                    <div className="hidden lg:flex flex-col items-end pl-3 border-l border-[#1E293B]">
                      <span className="text-xs font-black text-[#F1F5F9]">
                        ${play.avg_target_price}
                      </span>
                      <span className="text-[10px] text-[#38BDF8]">
                        Avg Target
                      </span>
                    </div>
                  )}

                  {/* Conviction Gauge */}
                  <div className="hidden sm:flex flex-col items-end pl-3 border-l border-[#1E293B]">
                    <span className="text-xs font-bold text-[#F1F5F9]">
                      {convictionVal}/100
                    </span>
                    <span className="text-[10px] text-[#64748B]">
                      Conviction
                    </span>
                  </div>
                </div>

                {/* Inspect Action Arrow Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setInspectedPlay(play)
                  }}
                  className="p-2 rounded-xl bg-[#141B2D] border border-[#1E293B] text-[#8B95A8] group-hover/row:text-[#00D4AA] group-hover/row:border-[#00D4AA]/40 transition-all hover:scale-105"
                  title="Inspect analyst quotes & videos"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer Navigation CTA */}
      <div className="relative z-10 mt-6 pt-5 border-t border-[#1E293B]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-[#8B95A8]">
          <Activity className="w-3.5 h-3.5 text-[#00D4AA]" />
          <span>
            Showing top {topBuys.length} ranked buys out of <strong>{plays.length}</strong> active 30-day plays.
          </span>
        </div>

        <div className="flex items-center gap-3">
          {limit === 5 && (
            <button
              type="button"
              onClick={() => setLimit(10)}
              className="text-xs text-[#8B95A8] hover:text-[#F1F5F9] font-bold font-[family-name:var(--font-geist-mono)] transition-colors"
            >
              Expand to Top 10 →
            </button>
          )}

          <Link
            href="/today"
            className="inline-flex items-center gap-1.5 text-xs text-[#00D4AA] hover:text-[#00FFD0] font-black uppercase tracking-wider font-[family-name:var(--font-geist-mono)] transition-colors group/screener-link"
          >
            <span>Explore Full 30-Day Screener</span>
            <ArrowRight className="w-3.5 h-3.5 transform group-hover/screener-link:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Slide-out Quick Peek Drawer for Inspected Play */}
      {inspectedPlay && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setInspectedPlay(null)}
        >
          <div
            className="relative w-full max-w-lg h-full bg-[#0A0F1A] border-l border-[#1E293B] shadow-2xl p-6 overflow-y-auto flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              {/* Drawer Header */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#1E293B]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-[family-name:var(--font-geist-mono)] text-3xl font-black text-[#F1F5F9]">
                      {inspectedPlay.ticker}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-md font-bold font-[family-name:var(--font-geist-mono)] bg-[#00D4AA]/10 text-[#00D4AA] border border-[#00D4AA]/30">
                      RANK #{inspectedPlay.rank}
                    </span>
                  </div>
                  <p className="text-sm text-[#8B95A8] mt-1">{inspectedPlay.stock_name}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setInspectedPlay(null)}
                  className="p-2 rounded-xl bg-[#141B2D] border border-[#1E293B] text-[#8B95A8] hover:text-[#F1F5F9] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 py-4 border-b border-[#1E293B] font-[family-name:var(--font-geist-mono)] text-center">
                <div className="p-2.5 rounded-xl bg-[#141B2D]/70 border border-white/5">
                  <span className="block text-[9px] uppercase tracking-wider text-[#64748B]">Aura Score</span>
                  <span className="text-lg font-black text-[#00D4AA]">{inspectedPlay.aura_score}/100</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#141B2D]/70 border border-white/5">
                  <span className="block text-[9px] uppercase tracking-wider text-[#64748B]">Agreement</span>
                  <span className="text-lg font-black text-[#F1F5F9]">{inspectedPlay.agreement_pct}%</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#141B2D]/70 border border-white/5">
                  <span className="block text-[9px] uppercase tracking-wider text-[#64748B]">Channels</span>
                  <span className="text-lg font-black text-[#38BDF8]">{inspectedPlay.analyst_count}</span>
                </div>
              </div>

              {/* Executive Thesis */}
              <div className="py-4 border-b border-[#1E293B]">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#64748B] font-[family-name:var(--font-geist-mono)] mb-2">
                  Executive Consensus Thesis
                </h4>
                <p className="text-sm text-[#F1F5F9] leading-relaxed bg-[#141B2D]/40 p-3.5 rounded-xl border border-white/5">
                  {inspectedPlay.executive_thesis}
                </p>
              </div>

              {/* Individual Analyst Opinions / Catalysts */}
              <div className="py-4 space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#64748B] font-[family-name:var(--font-geist-mono)]">
                  Analyst Transcripts &amp; Catalysts ({inspectedPlay.catalysts?.length || 0})
                </h4>

                <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                  {inspectedPlay.catalysts && inspectedPlay.catalysts.length > 0 ? (
                    inspectedPlay.catalysts.map((cat, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-[#141B2D]/50 border border-white/5 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-[11px] font-[family-name:var(--font-geist-mono)]">
                          <span className="font-bold text-[#00D4AA]">{cat.channel_name}</span>
                          <span className="text-[#64748B]">{cat.published_at ? formatRelativeTime(cat.published_at) : ''}</span>
                        </div>
                        <p className="text-[#8B95A8] leading-relaxed italic">
                          &ldquo;{cat.notes}&rdquo;
                        </p>
                        {cat.youtube_video_id && (
                          <Link
                            href={`/video?id=${cat.youtube_video_id}`}
                            className="inline-flex items-center gap-1 text-[10px] text-[#38BDF8] hover:underline font-bold font-[family-name:var(--font-geist-mono)]"
                          >
                            <span>Watch YouTube Clip</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#64748B]">No individual transcript quotes recorded.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Bottom Actions */}
            <div className="pt-4 border-t border-[#1E293B] flex gap-3">
              <button
                type="button"
                onClick={() => {
                  router.push(`/ticker?s=${inspectedPlay.ticker}`)
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-[#00D4AA] text-[#0A0F1A] font-black font-[family-name:var(--font-geist-mono)] text-xs tracking-wider uppercase hover:bg-[#00FFD0] transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,212,170,0.3)]"
              >
                <span>Open Full Ticker Dossier</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
