'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { AggregatedTicker } from '@/lib/types'
import { getSentimentBadgeClass, getSentimentLabel, PulseBar, ConvictionMini } from '@/components/TickerRow'
import { Flame, TrendingUp, TrendingDown, Target, ArrowRight } from 'lucide-react'

type TabKey = 'active' | 'bullish' | 'bearish' | 'upside'

interface TabOption {
  key: TabKey
  label: string
  shortLabel: string
  icon: React.ElementType
  color: string
  activeBg: string
  activeBorder: string
}

const TABS: TabOption[] = [
  {
    key: 'active',
    label: 'Most Active',
    shortLabel: 'Active',
    icon: Flame,
    color: 'text-[#F59E0B]',
    activeBg: 'bg-[#F59E0B]/10',
    activeBorder: 'border-[#F59E0B]/40',
  },
  {
    key: 'bullish',
    label: 'Top Bullish',
    shortLabel: 'Bullish',
    icon: TrendingUp,
    color: 'text-[#00D4AA]',
    activeBg: 'bg-[#00D4AA]/10',
    activeBorder: 'border-[#00D4AA]/40',
  },
  {
    key: 'bearish',
    label: 'Top Bearish',
    shortLabel: 'Bearish',
    icon: TrendingDown,
    color: 'text-[#FF4D6A]',
    activeBg: 'bg-[#FF4D6A]/10',
    activeBorder: 'border-[#FF4D6A]/40',
  },
  {
    key: 'upside',
    label: 'Highest Targets',
    shortLabel: 'Targets',
    icon: Target,
    color: 'text-[#38BDF8]',
    activeBg: 'bg-[#38BDF8]/10',
    activeBorder: 'border-[#38BDF8]/40',
  },
]

export default function HomeMarketMovers({
  aggregated,
  topTicker,
}: {
  aggregated: AggregatedTicker[]
  topTicker?: string
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('active')

  const tabData = useMemo(() => {
    if (!aggregated || aggregated.length === 0) return []

    if (activeTab === 'active') {
      return [...aggregated].sort((a, b) => b.mention_count - a.mention_count).slice(0, 6)
    }

    if (activeTab === 'bullish') {
      const bulls = [...aggregated]
        .filter((t) => t.consensus_sentiment >= 0.5)
        .sort((a, b) => b.avg_conviction * b.consensus_sentiment - a.avg_conviction * a.consensus_sentiment)
      if (bulls.length > 0) return bulls.slice(0, 6)
      return [...aggregated].sort((a, b) => b.consensus_sentiment - a.consensus_sentiment).slice(0, 6)
    }

    if (activeTab === 'bearish') {
      const bears = [...aggregated]
        .filter((t) => t.consensus_sentiment <= -0.2)
        .sort((a, b) => a.consensus_sentiment - b.consensus_sentiment)
      if (bears.length > 0) return bears.slice(0, 6)
      return [...aggregated].sort((a, b) => a.consensus_sentiment - b.consensus_sentiment).slice(0, 6)
    }

    if (activeTab === 'upside') {
      const withTargets = [...aggregated]
        .filter((t) => t.avg_target_price !== null && t.consensus_sentiment >= 0)
        .sort((a, b) => (b.avg_target_price || 0) - (a.avg_target_price || 0))
      if (withTargets.length > 0) return withTargets.slice(0, 6)
      return [...aggregated].slice(0, 6)
    }

    return []
  }, [aggregated, activeTab])

  if (aggregated.length === 0) return null

  return (
    <section className="mb-12 animate-fade-up">
      {/* Console Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#00D4AA] animate-pulse" />
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#64748B] font-[family-name:var(--font-geist-mono)]">
              Market Movers Console
            </h2>
          </div>
          <p className="text-sm text-[#8B95A8] font-normal">
            Real-time consensus ranking across top financial video transcripts.
          </p>
        </div>

        {/* Tab switcher buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#141B2D]/80 border border-[#1E293B] overflow-x-auto hide-scrollbar shrink-0">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isSelected = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-[family-name:var(--font-geist-mono)] transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? `${tab.activeBg} ${tab.color} border ${tab.activeBorder} shadow-sm`
                    : 'text-[#64748B] hover:text-[#CBD5E1] border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? tab.color : 'text-[#64748B]'}`} />
                <span className="hidden md:inline">{tab.label}</span>
                <span className="md:hidden">{tab.shortLabel}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Movers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tabData.map((ticker, index) => {
          const isTop = ticker.ticker === topTicker
          const isBull = ticker.consensus_sentiment >= 0.5
          const isBear = ticker.consensus_sentiment <= -0.5
          const glowBorder = isBull
            ? 'hover:border-[#00D4AA]/40 hover:shadow-[0_8px_30px_-8px_rgba(0,212,170,0.15)]'
            : isBear
            ? 'hover:border-[#FF4D6A]/40 hover:shadow-[0_8px_30px_-8px_rgba(255,77,106,0.15)]'
            : 'hover:border-[#F1F5F9]/30 hover:shadow-[0_8px_30px_-8px_rgba(241,245,249,0.1)]'

          return (
            <Link
              key={ticker.ticker}
              href={`/ticker?s=${ticker.ticker}`}
              className={`group relative flex flex-col justify-between p-5 rounded-2xl bg-[#141B2D]/40 backdrop-blur-md border border-[#1E293B]/70 ${glowBorder} transition-all duration-300 hover:-translate-y-1 overflow-hidden`}
            >
              {/* Top Row: Rank, Ticker, Sentiment Badge */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-[family-name:var(--font-geist-mono)] text-xs font-black text-[#475569] px-1.5 py-0.5 rounded bg-[#0A0F1A]/80 border border-[#1E293B]">
                      #{String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-[family-name:var(--font-geist-mono)] text-2xl font-black text-[#F1F5F9] tracking-wide group-hover:text-[#00D4AA] transition-colors">
                          {ticker.ticker}
                        </span>
                        {isTop && (
                          <span className="text-[9px] font-black uppercase tracking-wider text-[#00D4AA] bg-[#00D4AA]/10 border border-[#00D4AA]/30 px-1.5 py-0.5 rounded font-[family-name:var(--font-geist-mono)]">
                            AURA #1
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#64748B] truncate max-w-[180px] font-normal">
                        {ticker.stock_name || 'Tracked Asset'}
                      </p>
                    </div>
                  </div>

                  <span className={getSentimentBadgeClass(ticker.consensus_sentiment)}>
                    {getSentimentLabel(ticker.consensus_sentiment)}
                  </span>
                </div>

                {/* Sentiment Pulse Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-[10px] text-[#64748B] font-[family-name:var(--font-geist-mono)] mb-1">
                    <span>Consensus Score</span>
                    <span className="font-bold text-[#CBD5E1]">
                      {ticker.consensus_sentiment > 0 ? `+${ticker.consensus_sentiment.toFixed(2)}` : ticker.consensus_sentiment.toFixed(2)}
                    </span>
                  </div>
                  <PulseBar value={ticker.consensus_sentiment} isTop={isTop} />
                </div>
              </div>

              {/* Bottom Metrics Bar */}
              <div className="pt-3 border-t border-[#1E293B]/60 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-[#64748B] font-[family-name:var(--font-geist-mono)] block">
                    CONVICTION
                  </span>
                  <div className="mt-0.5">
                    <ConvictionMini level={ticker.avg_conviction} />
                  </div>
                </div>

                {ticker.avg_target_price !== null && (
                  <div className="text-right">
                    <span className="text-[10px] text-[#64748B] font-[family-name:var(--font-geist-mono)] block">
                      AVG TARGET
                    </span>
                    <span className="font-[family-name:var(--font-geist-mono)] font-bold text-[#F1F5F9] text-xs">
                      ${ticker.avg_target_price.toFixed(0)}
                    </span>
                  </div>
                )}

                <div className="text-right">
                  <span className="text-[10px] text-[#64748B] font-[family-name:var(--font-geist-mono)] block">
                    COVERAGE
                  </span>
                  <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[#8B95A8] font-bold">
                    {ticker.mention_count}m <span className="font-normal text-[10px] text-[#475569]">({ticker.analyst_count}ch)</span>
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Bottom Screener Link */}
      <div className="flex items-center justify-between mt-4 px-1 text-xs">
        <span className="text-[11px] text-[#64748B] font-[family-name:var(--font-geist-mono)]">
          Showing top {tabData.length} consensus picks
        </span>
        <Link
          href="/explore"
          className="text-xs text-[#00D4AA] hover:text-[#00FFD0] font-bold font-[family-name:var(--font-geist-mono)] flex items-center gap-1.5 transition-colors"
        >
          <span>Open Full Screener</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </section>
  )
}
