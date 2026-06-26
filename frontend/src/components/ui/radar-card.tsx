'use client'

import Link from 'next/link'
import { RadarConfig } from '@/lib/radars'
import { AggregatedTicker } from '@/lib/types'

// Reusing some helpers for display - in a real app these might be moved to a shared utils file.
function getSentimentLabel(value: number): string {
  if (value >= 1.5) return "Strong Buy"
  if (value >= 0.5) return "Buy"
  if (value > -0.5) return "Neutral"
  if (value > -1.5) return "Sell"
  return "Strong Sell"
}

function getSentimentBadgeClass(value: number): string {
  if (value >= 1.5) return "sentiment-badge sentiment-badge-strong-buy"
  if (value >= 0.5) return "sentiment-badge sentiment-badge-buy"
  if (value > -0.5) return "sentiment-badge sentiment-badge-neutral"
  if (value > -1.5) return "sentiment-badge sentiment-badge-sell"
  return "sentiment-badge sentiment-badge-strong-sell"
}

function sentimentToPercent(value: number): number {
  return ((value + 2) / 4) * 100
}

function PulseBar({ value }: { value: number }) {
  const percent = sentimentToPercent(value)
  const isStrong = Math.abs(value) >= 1.5

  return (
    <div className={`relative w-full h-2 rounded-full bg-[#1E293B] overflow-hidden ${isStrong ? 'h-2.5' : ''}`}>
      <div
        className="pulse-bar-fill absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${percent}%`,
          background: `linear-gradient(90deg, var(--aura-bear-strong) 0%, var(--aura-bear) 20%, #F59E0B 50%, var(--aura-bull) 80%, var(--aura-bull-strong) 100%)`,
          opacity: 0.9,
        }}
      />
    </div>
  )
}

export default function RadarCard({
  config,
  tickers,
}: {
  config: RadarConfig
  tickers: AggregatedTicker[]
}) {
  // Simple average of all constituents that have data
  const validTickers = tickers.filter((t) => t.mention_count > 0)
  const avgSentiment =
    validTickers.length > 0
      ? validTickers.reduce((sum, t) => sum + t.consensus_sentiment, 0) / validTickers.length
      : 0
  const totalMentions = validTickers.reduce((sum, t) => sum + t.mention_count, 0)

  // Use view transitions by setting a unique view-transition-name
  const vtName = `radar-${config.slug}`

  return (
    <Link
      href={`/radars/${config.slug}`}
      className="group relative flex flex-col p-6 rounded-3xl bg-[#141B2D]/60 backdrop-blur-xl border border-white/5 transition-all duration-500 hover:-translate-y-1 hover:border-white/10 hover:shadow-2xl overflow-hidden"
      style={{ viewTransitionName: vtName } as any}
    >
      {/* Ambient Aura Background */}
      <div
        className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] ${config.gradient} pointer-events-none`}
      />

      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-3xl tracking-tight font-black text-[#F1F5F9] mb-1 font-[family-name:var(--font-geist-sans)]">
              {config.name}
            </h2>
            <p className="text-xs text-[#8B95A8] max-w-[90%] leading-relaxed">
              {config.description}
            </p>
          </div>
          <div className="text-[#64748B] group-hover:text-[#F1F5F9] transition-colors">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"
            >
              <path d="M7 17l9.2-9.2M17 17V7H7" />
            </svg>
          </div>
        </div>

        {/* Constituents Preview */}
        <div className="mb-6 flex flex-wrap gap-1.5">
          {config.tickers.map((tickerSymbol) => {
            const hasData = validTickers.find((t) => t.ticker === tickerSymbol)
            return (
              <span
                key={tickerSymbol}
                className={`text-[10px] font-[family-name:var(--font-geist-mono)] px-2 py-1 rounded-md border ${
                  hasData
                    ? 'bg-[#1E293B]/50 border-[#2D3A4F] text-[#F1F5F9]'
                    : 'bg-transparent border-white/5 text-[#475569]'
                }`}
              >
                {tickerSymbol}
              </span>
            )
          })}
        </div>

        {/* Pulse Bar Footer */}
        <div className="mt-auto pt-4 border-t border-white/5 flex flex-col gap-2">
          <div className="flex justify-between items-end">
            <span className={getSentimentBadgeClass(avgSentiment)}>
              {getSentimentLabel(avgSentiment)}
            </span>
            <div className="text-[10px] font-[family-name:var(--font-geist-mono)] text-[#64748B]">
              {totalMentions} Mentions
            </div>
          </div>
          <PulseBar value={avgSentiment} />
        </div>
      </div>
    </Link>
  )
}
