'use client'

import { useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { ShieldCheck, ArrowRight, Activity } from 'lucide-react'
import { Play, TopAlphaPlay } from '@/lib/types'
import { filterTopBuyPlays, ALPHA_GATE_CRITERIA } from '@/lib/alpha-ranking'
import TopAlphaRow from './TopAlphaRow'
import TopAlphaDrawer from './TopAlphaDrawer'
import TopAlphaZeroState from './TopAlphaZeroState'

export interface TopAlphaSectionProps {
  plays: Play[]
  loading?: boolean
  variant?: 'compact' | 'full'
  showScreenerLink?: boolean
}

export function TopAlphaSkeleton() {
  return (
    <section className="relative rounded-3xl border border-[#1E293B]/60 bg-[#141B2D]/40 overflow-hidden mb-8 p-5 sm:p-6 md:p-8 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="space-y-2">
          <div className="h-4 w-36 bg-[#1E293B] rounded-lg" />
          <div className="h-7 w-60 bg-[#1E293B] rounded-xl" />
        </div>
        <div className="h-8 w-44 bg-[#1E293B] rounded-xl" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-[#0A0F1A]/80 border border-[#1E293B] rounded-2xl" />
        ))}
      </div>
    </section>
  )
}

export default function TopAlphaSection({
  plays,
  loading = false,
  variant = 'full',
  showScreenerLink = true,
}: TopAlphaSectionProps) {
  const [inspectedPlay, setInspectedPlay] = useState<TopAlphaPlay | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // Pure strict quantitative filtering (0 to 10 plays, NO relaxation)
  const topBuys = useMemo(() => {
    return filterTopBuyPlays(plays, 10)
  }, [plays])

  if (loading && plays.length === 0) {
    return <TopAlphaSkeleton />
  }

  // Institutional Zero-State if no stocks meet the strict bar
  if (!loading && topBuys.length === 0) {
    return (
      <section id="top-buys-now" className="mb-8">
        <TopAlphaZeroState totalPlays={plays.length} />
      </section>
    )
  }

  const count = topBuys.length
  const headingText = count === 1 ? 'Top Stock to Buy Today' : `Top ${count} Stocks to Buy Today`

  return (
    <section
      ref={cardRef}
      id="top-buys-now"
      className={`group relative rounded-3xl border border-[#1E293B] bg-[#141B2D]/55 backdrop-blur-md overflow-hidden mb-8 ${
        variant === 'compact' ? 'p-4 sm:p-5 md:p-6' : 'p-4 sm:p-6 md:p-8'
      } transition-all duration-500 shadow-2xl shadow-black/40 animate-fade-up`}
    >
      {/* Soft Ambient Radial Glow */}
      <div className="absolute top-0 right-1/4 w-[350px] h-[350px] rounded-full blur-[130px] pointer-events-none bg-gradient-to-br from-[#00D4AA]/10 via-[#00FFD0]/5 to-transparent opacity-60" />

      {/* Streamlined Executive Header */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 sm:pb-6 border-b border-[#1E293B]/80">
        <div>
          {/* Eyebrow Pill */}
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

          {/* Dynamic Title */}
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#F1F5F9] tracking-tight">
              {headingText}
            </h2>
            <span className="text-xs text-[#8B95A8] font-normal hidden sm:inline">
              Filtered by strict multi-channel consensus &amp; conviction
            </span>
          </div>
        </div>

        {/* Institutional Conviction Gate Transparency Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00D4AA]/10 border border-[#00D4AA]/25 text-[11px] font-bold text-[#00D4AA] font-[family-name:var(--font-geist-mono)] shadow-[0_0_15px_rgba(0,212,170,0.1)]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00D4AA] shrink-0" />
            <span>
              {count} of {plays.length} cleared Gate
            </span>
          </div>
          <span className="text-[10px] text-[#64748B] font-[family-name:var(--font-geist-mono)] hidden xl:inline">
            (≥{ALPHA_GATE_CRITERIA.MIN_CHANNELS} channels, ≥{ALPHA_GATE_CRITERIA.MIN_AGREEMENT_PCT}% agreement, ≥{ALPHA_GATE_CRITERIA.MIN_AURA_SCORE} Aura)
          </span>
        </div>
      </div>

      {/* Top N Stock Leaderboard Stack */}
      <div className="relative z-10 mt-4 sm:mt-5 space-y-3">
        {topBuys.map((play) => (
          <TopAlphaRow
            key={play.ticker}
            play={play}
            onInspect={(p) => setInspectedPlay(p)}
          />
        ))}
      </div>

      {/* Footer Status Bar */}
      <div className="relative z-10 mt-5 pt-4 sm:pt-5 border-t border-[#1E293B]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 text-xs font-[family-name:var(--font-geist-mono)]">
        <div className="flex items-center gap-2 text-[#8B95A8]">
          <Activity className="w-3.5 h-3.5 text-[#00D4AA] shrink-0" />
          <span>
            Showing all <strong className="text-[#F1F5F9]">{count}</strong> qualified buys from {plays.length} total active 30-day plays.
          </span>
        </div>

        {showScreenerLink && (
          <Link
            href="/today"
            className="inline-flex items-center gap-1.5 text-xs text-[#00D4AA] hover:text-[#00FFD0] font-black uppercase tracking-wider transition-colors group/screener-link"
          >
            <span>Explore Full 30-Day Market Screener</span>
            <ArrowRight className="w-3.5 h-3.5 transform group-hover/screener-link:translate-x-1 transition-transform" />
          </Link>
        )}
      </div>

      {/* Slide-out / Bottom-sheet Drawer */}
      <TopAlphaDrawer
        play={inspectedPlay}
        onClose={() => setInspectedPlay(null)}
      />
    </section>
  )
}
