'use client'

import Link from 'next/link'
import { AggregatedTicker } from '@/lib/types'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'

interface HomeTickerTapeProps {
  tickers: AggregatedTicker[]
  loading?: boolean
}

export default function HomeTickerTape({ tickers, loading = false }: HomeTickerTapeProps) {
  if (loading) {
    return (
      <div className="relative w-full overflow-hidden border-y border-[#1E293B]/50 bg-[#141B2D]/30 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-6 px-4 animate-pulse">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#00D4AA] shrink-0 font-[family-name:var(--font-geist-mono)]">
            <span className="w-2 h-2 rounded-full bg-[#00D4AA] animate-ping" />
            <span>LIVE CONSENSUS</span>
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

  // Filter tickers to display top 14 active ones
  const activeTickers = tickers.slice(0, 14)
  if (activeTickers.length === 0) return null

  // Duplicate list to achieve continuous seamless loop
  const marqueeItems = [...activeTickers, ...activeTickers]

  return (
    <div className="relative w-full overflow-hidden border-y border-[#1E293B]/60 bg-[#141B2D]/40 py-2.5 backdrop-blur-md select-none group/tape">
      {/* Left & Right gradient masks */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 md:w-24 z-10 bg-gradient-to-r from-[#0A0F1A] via-[#0A0F1A]/80 to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 md:w-24 z-10 bg-gradient-to-l from-[#0A0F1A] via-[#0A0F1A]/80 to-transparent" />

      <div className="flex items-center">
        {/* Pinned label */}
        <div className="hidden sm:flex items-center gap-2 pl-4 pr-3 py-0.5 shrink-0 z-20 bg-[#0A0F1A]/90 border-r border-[#1E293B] font-[family-name:var(--font-geist-mono)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D4AA] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00D4AA]" />
          </span>
          <span className="text-[10px] font-black uppercase tracking-wider text-[#F1F5F9]">
            RADAR PULSE
          </span>
        </div>

        {/* Marquee track */}
        <div className="animate-marquee flex items-center gap-6 sm:gap-8 px-4">
          {marqueeItems.map((item, idx) => {
            const isBullish = item.consensus_sentiment >= 0.5
            const isBearish = item.consensus_sentiment <= -0.5
            const badgeBg = isBullish
              ? 'bg-[#00D4AA]/10 border-[#00D4AA]/30 text-[#00D4AA]'
              : isBearish
              ? 'bg-[#FF4D6A]/10 border-[#FF4D6A]/30 text-[#FF4D6A]'
              : 'bg-[#1E293B]/60 border-[#1E293B] text-[#8B95A8]'

            return (
              <Link
                key={`${item.ticker}-${idx}`}
                href={`/ticker?s=${item.ticker}`}
                className="inline-flex items-center gap-2.5 shrink-0 px-2 py-1 rounded-lg hover:bg-[#1E293B]/60 transition-colors group/item"
              >
                <span className="font-[family-name:var(--font-geist-mono)] text-xs md:text-sm font-black text-[#F1F5F9] group-hover/item:text-[#00D4AA] transition-colors">
                  {item.ticker}
                </span>

                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-[family-name:var(--font-geist-mono)] border ${badgeBg}`}
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
                  <span className="hidden md:inline font-[family-name:var(--font-geist-mono)] text-[10px] text-[#64748B]">
                    ${item.avg_target_price.toFixed(0)}
                  </span>
                )}

                <span className="text-[10px] text-[#475569] font-[family-name:var(--font-geist-mono)]">
                  {item.mention_count}m
                </span>

                <span className="text-[#1E293B]">•</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
