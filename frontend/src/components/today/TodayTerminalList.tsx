'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Radio, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import TextScramble from '@/components/TextScramble'

export type SortOption = 'aura_score' | 'mentions' | 'conviction' | 'consensus_sentiment'

export const sortLabel: Record<SortOption, string> = {
  aura_score: 'Aura Score',
  mentions: 'Mentions Buzz',
  conviction: 'Avg Conviction',
  consensus_sentiment: 'Sentiment Bias',
}

export interface TerminalPlayItem {
  ticker: string
  stock_name: string
  direction: 'BUY' | 'SELL'
  aura_score: number
  signal_tier?: string
  consensus_sentiment: number
  avg_conviction: number
  recent_mentions: number
}

interface TodayTerminalListProps {
  plays: TerminalPlayItem[]
  sortBy: SortOption
  activeTab: 'BUY' | 'SELL'
}

export default function TodayTerminalList({ plays, sortBy, activeTab }: TodayTerminalListProps) {
  const router = useRouter()
  if (plays.length === 0) return null

  const isBuy = activeTab === 'BUY'
  const activeColorText = isBuy ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'
  const activeColorBg = isBuy ? 'bg-[#00D4AA]' : 'bg-[#FF4D6A]'

  const maxMetric = Math.max(
    ...plays.map((p) => {
      if (sortBy === 'aura_score') return p.aura_score
      if (sortBy === 'mentions') return p.recent_mentions
      if (sortBy === 'conviction') return p.avg_conviction
      if (sortBy === 'consensus_sentiment') return Math.abs(p.consensus_sentiment)
      return 0
    }),
    1
  )

  return (
    <div className="w-full flex flex-col animate-fade-up pb-8 md:pb-0 bg-[#141B2D]/40 backdrop-blur-xl rounded-3xl border border-[#1E293B]/70 overflow-hidden shadow-2xl">
      {/* Table Header (Desktop only) */}
      <div className="hidden md:flex items-center px-6 py-4 bg-[#0A0F1A]/90 border-b border-[#1E293B] text-[10px] font-black font-[family-name:var(--font-geist-mono)] text-[#64748B] uppercase tracking-widest">
        <div className="w-14 shrink-0">Rank</div>
        <div className="w-28 shrink-0">Ticker</div>
        <div className="w-24 shrink-0">Tier</div>
        <div className="flex-1">Company</div>
        <div className="w-48 text-right pr-2">
          {sortLabel[sortBy]} <span className={activeColorText}>•</span>
        </div>
        <div className="w-6"></div>
      </div>

      {/* Table Rows */}
      <div className="flex flex-col divide-y divide-[#1E293B]/40">
        {plays.map((play, idx) => {
          const metricValue =
            sortBy === 'aura_score'
              ? play.aura_score
              : sortBy === 'mentions'
              ? play.recent_mentions
              : sortBy === 'conviction'
              ? play.avg_conviction
              : Math.abs(play.consensus_sentiment)

          const fillPct = (metricValue / maxMetric) * 100

          return (
            <div
              key={play.ticker}
              onClick={() => router.push(`/ticker?s=${play.ticker}`)}
              className="group relative flex items-center px-4 py-3.5 md:px-6 md:py-4 hover:bg-[#1E293B]/50 transition-colors duration-200 cursor-pointer overflow-hidden"
            >
              {/* Subtle hover gradient */}
              <div
                className={`absolute inset-0 bg-gradient-to-r ${
                  isBuy
                    ? 'from-[#00D4AA]/0 via-[#00D4AA]/5 to-transparent'
                    : 'from-[#FF4D6A]/0 via-[#FF4D6A]/5 to-transparent'
                } opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
              />

              {/* 1. Rank */}
              <div className="w-10 md:w-14 shrink-0 text-sm md:text-lg font-bold font-[family-name:var(--font-geist-mono)] text-[#475569] group-hover:text-[#F1F5F9] transition-colors relative z-10">
                {(idx + 1).toString().padStart(2, '0')}
              </div>

              {/* 2. Ticker */}
              <div
                className={`w-16 md:w-28 shrink-0 text-lg md:text-2xl font-black font-[family-name:var(--font-geist-mono)] ${activeColorText} tracking-widest relative z-10 drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]`}
              >
                <TextScramble text={play.ticker} duration={400} />
              </div>

              {/* 2.5 Tier (Desktop) */}
              <div className="w-24 shrink-0 hidden md:flex items-center relative z-10">
                {play.signal_tier === 'emerging' ? (
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded font-[family-name:var(--font-geist-mono)] tracking-wider uppercase flex items-center gap-1 border border-dashed ${
                      isBuy
                        ? 'bg-[#16A34A]/15 border-[#16A34A]/40 text-[#16A34A] shadow-[0_0_6px_rgba(22,163,74,0.2)]'
                        : 'bg-[#F87171]/10 border-[#F87171]/40 text-[#F87171] shadow-[0_0_6px_rgba(248,113,113,0.15)]'
                    }`}
                    title={isBuy ? 'Early Buy Radar: Score 35–49' : 'Early Sell Radar: Score 35–49'}
                  >
                    <Radio
                      className={`w-2 h-2 animate-pulse ${isBuy ? 'text-[#16A34A]' : 'text-[#F87171]'}`}
                    />{' '}
                    Radar
                  </span>
                ) : (
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded font-[family-name:var(--font-geist-mono)] tracking-wider uppercase ${
                      isBuy
                        ? 'bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA]'
                        : 'bg-[#FF4D6A]/10 border border-[#FF4D6A]/30 text-[#FF4D6A]'
                    }`}
                  >
                    Strong
                  </span>
                )}
              </div>

              {/* 3. Company */}
              <div className="flex-1 min-w-0 pr-4 relative z-10">
                <div className="text-[11px] md:text-xs text-[#8B95A8] font-bold truncate flex items-center gap-1.5">
                  <span className="truncate">{play.stock_name}</span>
                  {play.signal_tier === 'emerging' && (
                    <span
                      className={`md:hidden text-[8px] font-mono font-black px-1.5 py-0.5 rounded shrink-0 border border-dashed ${
                        isBuy
                          ? 'bg-[#16A34A]/15 border-[#16A34A]/40 text-[#16A34A]'
                          : 'bg-[#F87171]/10 border-[#F87171]/40 text-[#F87171]'
                      }`}
                    >
                      RADAR
                    </span>
                  )}
                </div>
              </div>

              {/* 4. Metric Bar */}
              <div className="flex flex-col items-end gap-1.5 shrink-0 w-20 md:w-48 relative z-10">
                <span
                  className={`text-sm md:text-lg font-black font-[family-name:var(--font-geist-mono)] ${activeColorText} leading-none`}
                >
                  {sortBy === 'conviction'
                    ? `${metricValue.toFixed(1)}`
                    : sortBy === 'mentions'
                    ? `${metricValue}x`
                    : metricValue.toFixed(1).replace('.0', '')}
                </span>
                <div className="w-full h-1 md:h-1.5 bg-[#0A0F1A] rounded-full overflow-hidden border border-white/5 shadow-inner">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${fillPct}%` }}
                    transition={{ duration: 0.8, delay: idx * 0.03, ease: 'easeOut' }}
                    className={`h-full ${activeColorBg} shadow-[0_0_8px_${isBuy ? '#00D4AA' : '#FF4D6A'}]`}
                  />
                </div>
              </div>

              {/* 5. Action Chevron */}
              <div className="w-6 shrink-0 flex justify-end relative z-10">
                <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-[#475569] group-hover:text-[#F1F5F9] transition-colors transform group-hover:translate-x-1" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
