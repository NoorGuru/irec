'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AggregatedTicker } from '@/lib/types'
import { getSentimentBadgeClass, getSentimentLabel, PulseBar } from '@/components/TickerRow'
import { ArrowUpRight, ArrowDownRight, Minus, Target, ArrowRight, X } from 'lucide-react'

interface HomeTickerTapeProps {
  tickers: AggregatedTicker[]
  loading?: boolean
}

export default function HomeTickerTape({ tickers, loading = false }: HomeTickerTapeProps) {
  const router = useRouter()
  const [activeTicker, setActiveTicker] = useState<AggregatedTicker | null>(null)
  const [clampedLeft, setClampedLeft] = useState<number>(16)
  const [isHoveringPopover, setIsHoveringPopover] = useState(false)
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const tapeContainerRef = useRef<HTMLDivElement>(null)

  // Smart Institutional Selection (Top 28 Diversified Tickers)
  const activeTickers = useMemo(() => {
    if (!tickers || tickers.length === 0) return []

    const selected: AggregatedTicker[] = []
    const seen = new Set<string>()

    const addTicker = (t: AggregatedTicker) => {
      if (t && !seen.has(t.ticker)) {
        seen.add(t.ticker)
        selected.push(t)
        return true
      }
      return false
    }

    // 1. Core Heavyweights (Top 12 by total coverage)
    const byMentions = [...tickers].sort((a, b) => b.mention_count - a.mention_count)
    for (const t of byMentions.slice(0, 12)) {
      addTicker(t)
    }

    // 2. High-Conviction Bullish Movers (Top 8 with sentiment >= 0.5)
    const bulls = [...tickers]
      .filter((t) => t.consensus_sentiment >= 0.5)
      .sort((a, b) => (b.consensus_sentiment * b.avg_conviction) - (a.consensus_sentiment * a.avg_conviction))
    for (const t of bulls) {
      if (selected.length >= 20) break
      addTicker(t)
    }

    // 3. Significant Bearish / Hedge Calls (Top 4 with sentiment <= -0.3)
    const bears = [...tickers]
      .filter((t) => t.consensus_sentiment <= -0.3)
      .sort((a, b) => a.consensus_sentiment - b.consensus_sentiment)
    for (const t of bears) {
      if (selected.length >= 24) break
      addTicker(t)
    }

    // 4. Highest Target Price Setups
    const withTargets = [...tickers]
      .filter((t) => t.avg_target_price !== null && t.consensus_sentiment >= 0)
      .sort((a, b) => (b.avg_target_price || 0) - (a.avg_target_price || 0))
    for (const t of withTargets) {
      if (selected.length >= 28) break
      addTicker(t)
    }

    // 5. Fill remaining slots up to 28 from the main roster
    for (const t of byMentions) {
      if (selected.length >= 28) break
      addTicker(t)
    }

    return selected
  }, [tickers])

  const handleMouseEnterItem = (item: AggregatedTicker, e: React.MouseEvent<HTMLElement>) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }

    const rect = e.currentTarget.getBoundingClientRect()
    const containerRect = tapeContainerRef.current?.getBoundingClientRect()
    const containerWidth = containerRect?.width || (typeof window !== 'undefined' ? window.innerWidth : 1200)

    // Calculate left relative to tape container
    const relativeCenter = rect.left - (containerRect?.left || 0) + rect.width / 2
    const popoverWidth = 360
    const clamped = Math.max(16, Math.min(containerWidth - popoverWidth - 16, relativeCenter - popoverWidth / 2))

    setActiveTicker(item)
    setClampedLeft(clamped)
  }

  const handleMouseLeaveItem = () => {
    closeTimeoutRef.current = setTimeout(() => {
      if (!isHoveringPopover) {
        setActiveTicker(null)
      }
    }, 200)
  }

  const handlePopoverMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    setIsHoveringPopover(true)
  }

  const handlePopoverMouseLeave = () => {
    setIsHoveringPopover(false)
    closeTimeoutRef.current = setTimeout(() => {
      setActiveTicker(null)
    }, 150)
  }

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    }
  }, [])

  if (loading) {
    return (
      <div className="relative w-full overflow-hidden border-y border-[#1E293B]/50 bg-[#141B2D]/30 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-6 px-4 animate-pulse">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#00D4AA] shrink-0 font-[family-name:var(--font-geist-mono)]">
            <span className="w-2 h-2 rounded-full bg-[#00D4AA] animate-ping" />
            <span>LIVE SIGNALS</span>
          </div>
          <div className="h-4 w-px bg-[#1E293B]" />
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <div className="h-4 w-12 bg-[#1E293B] rounded" />
              <div className="h-4 w-16 bg-[#1E293B]/60 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (activeTickers.length === 0) return null

  // Duplicate list to achieve continuous seamless loop
  const marqueeItems = [...activeTickers, ...activeTickers]

  return (
    <div
      ref={tapeContainerRef}
      className={`relative w-full border-y border-[#1E293B]/60 bg-[#141B2D]/40 py-2.5 backdrop-blur-md select-none group/tape ${
        activeTicker ? 'z-50' : 'z-20'
      }`}
    >
      {/* Horizontal track: strictly overflow-hidden so marquee pills never spill horizontally */}
      <div className="relative w-full overflow-hidden flex items-center">
        {/* Left & Right gradient masks */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 md:w-24 z-10 bg-gradient-to-r from-[#0A0F1A] via-[#0A0F1A]/80 to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 md:w-24 z-10 bg-gradient-to-l from-[#0A0F1A] via-[#0A0F1A]/80 to-transparent" />

        {/* Pinned label */}
        <div className="hidden sm:flex items-center gap-2 pl-4 pr-3 py-0.5 shrink-0 z-20 bg-[#0A0F1A]/95 border-r border-[#1E293B] font-[family-name:var(--font-geist-mono)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D4AA] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00D4AA]" />
          </span>
          <span className="text-[10px] font-black uppercase tracking-wider text-[#F1F5F9]">
            LIVE SIGNALS
          </span>
        </div>

        {/* Marquee track */}
        <div className="animate-marquee flex items-center gap-6 sm:gap-8 px-4">
          {marqueeItems.map((item, idx) => {
            const isBullish = item.consensus_sentiment >= 0.5
            const isBearish = item.consensus_sentiment <= -0.5
            const isSelected = activeTicker?.ticker === item.ticker

            const badgeBg = isBullish
              ? 'bg-[#00D4AA]/10 border-[#00D4AA]/30 text-[#00D4AA]'
              : isBearish
              ? 'bg-[#FF4D6A]/10 border-[#FF4D6A]/30 text-[#FF4D6A]'
              : 'bg-[#1E293B]/60 border-[#1E293B] text-[#8B95A8]'

            return (
              <div
                key={`${item.ticker}-${idx}`}
                onMouseEnter={(e) => handleMouseEnterItem(item, e)}
                onMouseLeave={handleMouseLeaveItem}
                onClick={() => router.push(`/ticker?s=${item.ticker}`)}
                className={`inline-flex items-center gap-2.5 shrink-0 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#00D4AA]/15 ring-1 ring-[#00D4AA]/40 shadow-sm'
                    : 'hover:bg-[#1E293B]/70 hover:scale-[1.02]'
                }`}
              >
                <span className="font-[family-name:var(--font-geist-mono)] text-xs md:text-sm font-black text-[#F1F5F9] group-hover:text-[#00D4AA] transition-colors">
                  {item.ticker}
                </span>

                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold font-[family-name:var(--font-geist-mono)] border ${badgeBg}`}
                >
                  {isBullish ? (
                    <ArrowUpRight className="w-3 h-3 shrink-0" />
                  ) : isBearish ? (
                    <ArrowDownRight className="w-3 h-3 shrink-0" />
                  ) : (
                    <Minus className="w-2.5 h-2.5 shrink-0" />
                  )}
                  <span>
                    {item.consensus_sentiment > 0 ? `+${item.consensus_sentiment.toFixed(2)}` : item.consensus_sentiment.toFixed(2)}
                  </span>
                </span>

                {item.avg_target_price !== null && (
                  <span className="hidden md:inline-flex items-center gap-0.5 font-[family-name:var(--font-geist-mono)] text-[10px] text-[#64748B]">
                    <Target className="w-2.5 h-2.5 text-[#64748B]" />
                    <span>${item.avg_target_price.toFixed(0)}</span>
                  </span>
                )}

                <span className="text-[10px] text-[#475569] font-[family-name:var(--font-geist-mono)]">
                  {item.mention_count} calls
                </span>

                <span className="text-[#1E293B]">•</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Floating Hover Intel Card (Anchored right below the tape) */}
      {activeTicker && (
        <div
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handlePopoverMouseLeave}
          style={{ left: `${clampedLeft}px` }}
          className="absolute top-[calc(100%+8px)] z-[100] w-[340px] sm:w-[360px] p-5 rounded-2xl bg-[#0A0F1A] border border-[#1E293B] shadow-[0_25px_70px_rgba(0,0,0,0.95)] ring-1 ring-white/10 animate-fade-up pointer-events-auto"
        >
          {/* Subtle Top Accent Glow */}
          <div
            className={`absolute top-0 left-6 right-6 h-0.5 rounded-full ${
              activeTicker.consensus_sentiment >= 0.5
                ? 'bg-gradient-to-r from-transparent via-[#00D4AA] to-transparent'
                : activeTicker.consensus_sentiment <= -0.5
                ? 'bg-gradient-to-r from-transparent via-[#FF4D6A] to-transparent'
                : 'bg-gradient-to-r from-transparent via-[#8B95A8] to-transparent'
            }`}
          />

          {/* Header Row: Ticker, Name, Sentiment Badge */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-geist-mono)] text-2xl font-black text-[#F1F5F9] tracking-wide">
                  {activeTicker.ticker}
                </span>
                <span className={getSentimentBadgeClass(activeTicker.consensus_sentiment)}>
                  {getSentimentLabel(activeTicker.consensus_sentiment)}
                </span>
              </div>
              <p className="text-xs text-[#64748B] truncate max-w-[220px] mt-0.5 font-normal">
                {activeTicker.stock_name || 'Tracked Asset'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveTicker(null)}
              className="p-1 rounded-lg text-[#64748B] hover:text-[#F1F5F9] hover:bg-[#1E293B] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Sentiment Pulse Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-[10px] text-[#64748B] font-[family-name:var(--font-geist-mono)] mb-1">
              <span>Consensus Score</span>
              <span className="font-bold text-[#CBD5E1]">
                {activeTicker.consensus_sentiment > 0
                  ? `+${activeTicker.consensus_sentiment.toFixed(2)}`
                  : activeTicker.consensus_sentiment.toFixed(2)}{' '}
                / 2.00
              </span>
            </div>
            <PulseBar value={activeTicker.consensus_sentiment} isTop={false} />
          </div>

          {/* Micro Metrics Matrix */}
          <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[#141B2D]/60 border border-[#1E293B]/70 mb-4 text-center">
            <div>
              <span className="text-[9px] text-[#64748B] font-[family-name:var(--font-geist-mono)] block uppercase">
                Target
              </span>
              <span className="font-[family-name:var(--font-geist-mono)] text-xs font-bold text-[#F1F5F9]">
                {activeTicker.avg_target_price !== null ? `$${activeTicker.avg_target_price.toFixed(0)}` : '—'}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-[#64748B] font-[family-name:var(--font-geist-mono)] block uppercase">
                Conviction
              </span>
              <span className="font-[family-name:var(--font-geist-mono)] text-xs font-bold text-[#00D4AA]">
                {activeTicker.avg_conviction.toFixed(1)}/10
              </span>
            </div>
            <div>
              <span className="text-[9px] text-[#64748B] font-[family-name:var(--font-geist-mono)] block uppercase">
                Analysts
              </span>
              <span className="font-[family-name:var(--font-geist-mono)] text-xs font-bold text-[#CBD5E1]">
                {activeTicker.analyst_count} <span className="text-[9px] text-[#64748B]">({activeTicker.mention_count} calls)</span>
              </span>
            </div>
          </div>

          {/* Action Link */}
          <Link
            href={`/ticker?s=${activeTicker.ticker}`}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#00D4AA]/15 hover:bg-[#00D4AA] text-[#00D4AA] hover:text-[#0A0F1A] font-bold text-xs font-[family-name:var(--font-geist-mono)] transition-all duration-200 group/btn"
          >
            <span>Open {activeTicker.ticker} Terminal</span>
            <ArrowRight className="w-3.5 h-3.5 transform group-hover/btn:translate-x-1 transition-transform" />
          </Link>
        </div>
      )}
    </div>
  )
}
