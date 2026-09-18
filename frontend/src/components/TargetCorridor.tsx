'use client'

import React from 'react'
import {
  Target,
  Sparkles,
  Compass,
  HelpCircle,
} from 'lucide-react'

export interface TargetItem {
  price: number
  channelName?: string
  publishedAt?: string
  sentiment?: number
}

interface TargetCorridorProps {
  prices: number[]
  avgPrice: number | null
  ticker: string
  targets?: TargetItem[]
  totalRecommendations?: number
  rawSentiment?: number
  consensusSentiment?: number
  avgConviction?: number
}

function formatPrice(p: number | null | undefined): string {
  if (p == null) return '—'
  if (p >= 100) return p.toFixed(0)
  if (p >= 1) return p.toFixed(2)
  return p.toFixed(4)
}

function getSentimentBadgeClass(sentiment: number): string {
  if (sentiment >= 2) return 'sentiment-badge sentiment-badge-strong-buy'
  if (sentiment >= 1) return 'sentiment-badge sentiment-badge-buy'
  if (sentiment <= -2) return 'sentiment-badge sentiment-badge-strong-sell'
  if (sentiment <= -1) return 'sentiment-badge sentiment-badge-sell'
  return 'sentiment-badge sentiment-badge-neutral'
}

function getSentimentLabel(sentiment: number): string {
  if (sentiment >= 1.5) return 'Strong Buy'
  if (sentiment >= 0.5) return 'Buy'
  if (sentiment <= -1.5) return 'Strong Sell'
  if (sentiment <= -0.5) return 'Sell'
  return 'Neutral'
}

function SentimentArrow({ value }: { value: number }) {
  if (value >= 1.5) {
    return (
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="inline-block shrink-0">
        <path d="M7 2L7 12M7 2L3 6M7 2L11 6" stroke="#00FFD0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (value <= -1.5) {
    return (
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="inline-block shrink-0">
        <path d="M7 12L7 2M7 12L3 8M7 12L11 8" stroke="#FF1744" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return null
}

function ConvictionDots({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-0.5" title={`Conviction: ${level}/10`}>
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i < level ? 'bg-[#00D4AA]' : 'bg-[#1E293B]'
          }`}
        />
      ))}
    </div>
  )
}

export default function TargetCorridor({
  prices,
  avgPrice,
  ticker,
  targets = [],
  totalRecommendations = 0,
  rawSentiment = 0,
  consensusSentiment = 0,
  avgConviction = 0,
}: TargetCorridorProps) {
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0
  const count = prices.length
  const isSingleTarget = count === 1 || (count > 1 && minPrice === maxPrice)
  const isZeroTarget = !prices || prices.length === 0 || avgPrice === null
  const primaryTarget = avgPrice ?? (prices.length > 0 ? prices[0] : 0)

  const range = maxPrice - minPrice || 1
  const avgPos = Math.max(0, Math.min(100, ((primaryTarget - minPrice) / range) * 100))
  const spread = maxPrice - minPrice
  const spreadPct = minPrice > 0 ? (spread / minPrice) * 100 : 0
  const singleChannelName = targets.length > 0 ? targets[0]?.channelName : undefined

  return (
    <div className="p-5 md:p-6 rounded-2xl bg-[#141B2D]/70 backdrop-blur-xl border border-white/5 shadow-xl shadow-black/20 relative overflow-hidden transition-all duration-300">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-1/4 w-48 h-48 bg-[#00D4AA]/5 blur-3xl rounded-full pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00D4AA]/20 to-[#00D4AA]/5 border border-[#00D4AA]/30 flex items-center justify-center text-[#00D4AA] shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#F1F5F9] font-[family-name:var(--font-geist-mono)]">
                Analyst Consensus & Target Corridor
              </h3>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border font-[family-name:var(--font-geist-mono)] ${
                isZeroTarget
                  ? 'text-[#8B95A8] bg-[#0A0F1A] border-[#1E293B]'
                  : 'text-[#00FFD0] bg-[#00D4AA]/10 border-[#00D4AA]/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isZeroTarget ? 'bg-[#64748B]' : 'bg-[#00FFD0] animate-pulse'}`} />
                {isZeroTarget
                  ? '0 Targets'
                  : count === 1
                  ? '1 Target'
                  : `${count} Targets`}
              </span>
              {isSingleTarget && singleChannelName && (
                <span className="hidden sm:inline-flex text-[10px] text-[#8B95A8] font-medium px-2 py-0.5 rounded-full bg-[#0A0F1A] border border-[#1E293B]">
                  via {singleChannelName}
                </span>
              )}
            </div>
            <p className="text-xs text-[#8B95A8] mt-0.5 font-[family-name:var(--font-geist-sans)]">
              {isZeroTarget
                ? (totalRecommendations > 0
                    ? `Tracked across ${totalRecommendations} analyst video ${totalRecommendations === 1 ? 'call' : 'calls'} • Awaiting explicit numeric price forecasts.`
                    : `No price targets published by tracked analysts for ${ticker} yet.`)
                : isSingleTarget
                ? (singleChannelName
                    ? `Explicit price target published by ${singleChannelName}. Awaiting secondary calls to expand spread corridor.`
                    : `Single price target established. Awaiting secondary calls to expand spread corridor.`)
                : `Consensus price target projection across ${count} explicit analyst video forecasts.`}
            </p>
          </div>
        </div>
      </div>

      {/* Visual Corridor / Horizon Area */}
      <div className="space-y-4 mb-6 relative z-10 px-2 sm:px-4">
        {isZeroTarget ? (
          /* Zero Target Horizon */
          <div className="relative h-14 rounded-xl bg-[#0A0F1A]/80 border border-[#1E293B]/70 flex items-center justify-center px-6 overflow-hidden">
            <div className="w-full border-b border-dashed border-[#1E293B]" />
            <div className="absolute inset-0 flex items-center justify-center gap-2 pointer-events-none text-xs text-[#64748B] font-[family-name:var(--font-geist-mono)]">
              <Compass className="w-4 h-4 text-[#64748B]" />
              <span>Awaiting initial analyst video target to establish corridor bounds</span>
            </div>
          </div>
        ) : isSingleTarget ? (
          /* Single Target Runway */
          <div className="relative h-16 rounded-xl bg-[#0A0F1A] border border-[#1E293B] flex items-center justify-center px-6 overflow-hidden">
            <div className="w-full border-b border-dashed border-[#1E293B]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative flex items-center gap-3 font-[family-name:var(--font-geist-mono)] bg-[#141B2D]/90 backdrop-blur-md px-5 py-2 rounded-xl border border-[#00D4AA]/30 shadow-lg shadow-black/40 z-10">
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-6 h-6 rounded-full bg-[#00FFD0]/20 animate-ping" />
                  <div className="w-3.5 h-3.5 rounded-full bg-[#00FFD0] shadow-[0_0_12px_#00FFD0]" />
                </div>
                <span className="text-xs text-[#8B95A8] uppercase tracking-wider font-semibold">
                  Analyst Target Level:
                </span>
                <span className="text-lg font-black text-[#00FFD0]">
                  ${formatPrice(primaryTarget)}
                </span>
                <span className="text-[10px] text-[#8B95A8] font-normal px-2 py-0.5 rounded bg-[#0A0F1A] border border-[#1E293B]">
                  {singleChannelName || '1 Call'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Multi-Target Corridor */
          <>
            {/* Track label above */}
            <div className="relative h-6 text-[11px] font-[family-name:var(--font-geist-mono)]">
              <div
                className="absolute -translate-x-1/2 flex flex-col items-center transition-all duration-500"
                style={{ left: `clamp(28px, ${avgPos}%, calc(100% - 28px))` }}
              >
                <span className="text-[10px] uppercase font-bold text-[#00D4AA] tracking-wider flex items-center gap-0.5">
                  <Sparkles className="w-2.5 h-2.5" /> Target Consensus
                </span>
                <span className="font-black text-[#00FFD0] text-sm">${formatPrice(avgPrice)}</span>
              </div>
            </div>

            {/* Bar & Markers */}
            <div className="relative h-4 rounded-full bg-[#0A0F1A] border border-[#1E293B] shadow-inner flex items-center">
              {/* Filled Corridor Span edge-to-edge */}
              <div className="absolute inset-y-0.5 left-0 right-0 rounded-full bg-gradient-to-r from-[#FF4D6A]/50 via-[#F59E0B]/50 to-[#00D4AA]/70 opacity-90" />

              {/* Low Target Pin */}
              <div
                className="absolute w-2.5 h-2.5 rounded-full bg-[#FF4D6A] -translate-x-1/2 shadow-[0_0_8px_#FF4D6A] z-10"
                style={{ left: 'clamp(5px, 0%, calc(100% - 5px))' }}
                title={`Bear Low: $${formatPrice(minPrice)}`}
              />

              {/* Consensus Target Pin */}
              <div
                className="absolute w-4 h-4 rounded-full bg-[#00FFD0] border-2 border-[#0A0F1A] -translate-x-1/2 shadow-[0_0_12px_#00FFD0] z-20 animate-pulse"
                style={{ left: `clamp(8px, ${avgPos}%, calc(100% - 8px))` }}
                title={`Consensus Target: $${formatPrice(avgPrice)}`}
              />

              {/* High Target Pin */}
              <div
                className="absolute w-2.5 h-2.5 rounded-full bg-[#00D4AA] -translate-x-1/2 shadow-[0_0_8px_#00D4AA] z-10"
                style={{ left: 'clamp(5px, 100%, calc(100% - 5px))' }}
                title={`Bull High: $${formatPrice(maxPrice)}`}
              />
            </div>

            {/* Min, Spread, and Max bounds below track */}
            <div className="flex justify-between text-[11px] text-[#64748B] font-[family-name:var(--font-geist-mono)] pt-1">
              <div className="flex flex-col items-start">
                <span className="text-[9px] uppercase tracking-wider text-[#8B95A8]">Bear Low</span>
                <span className="font-bold text-[#F1F5F9]">${formatPrice(minPrice)}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[9px] uppercase tracking-wider text-[#64748B]">Spread Corridor</span>
                <span className="font-semibold text-[#8B95A8]">
                  +${formatPrice(spread)} ({spreadPct.toFixed(0)}%) • {count} Targets
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] uppercase tracking-wider text-[#8B95A8]">Bull High</span>
                <span className="font-bold text-[#F1F5F9]">${formatPrice(maxPrice)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Unified 4-Metric Grid (Integrated Lower Console) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-5 border-t border-[#1E293B]/70 font-[family-name:var(--font-geist-mono)]">
        {/* Card 1: Raw Sentiment */}
        <div className="p-4 rounded-xl bg-[#0A0F1A]/80 border border-[#1E293B] flex flex-col justify-between">
          <span className="text-xs text-[#64748B] mb-1 font-[family-name:var(--font-geist-sans)]">Raw Sentiment</span>
          <p className={`text-2xl font-bold ${
            rawSentiment >= 1.5 ? 'sentiment-strong-buy' :
            rawSentiment >= 0.5 ? 'text-[#00D4AA]' :
            rawSentiment <= -1.5 ? 'sentiment-strong-sell' :
            rawSentiment <= -0.5 ? 'text-[#FF4D6A]' :
            'text-[#F1F5F9]'
          }`}>
            {rawSentiment.toFixed(1)}
          </p>
          <div className="mt-2">
            <span className={getSentimentBadgeClass(Math.round(rawSentiment))}>
              <SentimentArrow value={rawSentiment} />
              {getSentimentLabel(rawSentiment)}
            </span>
          </div>
        </div>

        {/* Card 2: Trust Consensus */}
        <div className="p-4 rounded-xl bg-[#0A0F1A]/80 border border-[#1E293B] flex flex-col justify-between">
          <div className="flex items-center gap-1.5 mb-1 font-[family-name:var(--font-geist-sans)]">
            <span className="text-xs text-[#64748B]">Trust Consensus</span>
            <span
              className="group/tip relative cursor-help"
              role="button"
              tabIndex={0}
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#475569] hover:text-[#64748B] transition-colors" />
              <span role="tooltip" className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 rounded-lg bg-[#1E293B] border border-[#2D3A4F] text-[10px] text-[#8B95A8] leading-relaxed opacity-0 group-hover/tip:opacity-100 transition-opacity duration-200 pointer-events-none z-20">
                Dampened by data confidence. Reaches full strength at 3+ mentions.
              </span>
            </span>
          </div>
          <p className={`text-2xl font-bold ${
            consensusSentiment >= 1.5 ? 'sentiment-strong-buy' :
            consensusSentiment >= 0.5 ? 'text-[#00D4AA]' :
            consensusSentiment <= -1.5 ? 'sentiment-strong-sell' :
            consensusSentiment <= -0.5 ? 'text-[#FF4D6A]' :
            'text-[#F1F5F9]'
          }`}>
            {consensusSentiment.toFixed(2)}
          </p>
          <div className="mt-2">
            <span className={getSentimentBadgeClass(consensusSentiment)}>
              <SentimentArrow value={consensusSentiment} />
              {getSentimentLabel(consensusSentiment)}
            </span>
          </div>
        </div>

        {/* Card 3: Target Consensus */}
        <div className="p-4 rounded-xl bg-[#0A0F1A]/80 border border-[#1E293B] flex flex-col justify-between">
          <span className="text-xs text-[#64748B] mb-1 font-[family-name:var(--font-geist-sans)]">Target Consensus</span>
          <div>
            <p className="text-2xl font-bold text-[#F1F5F9]">
              {avgPrice !== null ? `$${formatPrice(avgPrice)}` : '—'}
            </p>
            {count > 1 ? (
              <p className="text-xs text-[#64748B] mt-0.5">
                ${formatPrice(minPrice)} – ${formatPrice(maxPrice)}
              </p>
            ) : count === 1 ? (
              <p className="text-xs text-[#00D4AA] mt-0.5">
                Sole target call
              </p>
            ) : (
              <p className="text-xs text-[#64748B] mt-0.5">
                Awaiting price target
              </p>
            )}
          </div>
          <div className="mt-2 text-[10px] font-semibold text-[#8B95A8]">
            {count > 1
              ? `+$${formatPrice(spread)} Spread (${count} Calls)`
              : count === 1
              ? '1 Target Call'
              : '0 Targets Established'}
          </div>
        </div>

        {/* Card 4: Avg Conviction */}
        <div className="p-4 rounded-xl bg-[#0A0F1A]/80 border border-[#1E293B] flex flex-col justify-between">
          <span className="text-xs text-[#64748B] mb-1 font-[family-name:var(--font-geist-sans)]">Avg Conviction</span>
          <p className="text-2xl font-bold font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">
            {Math.round(avgConviction <= 10 ? avgConviction * 10 : avgConviction)}
            <span className="text-sm text-[#64748B] font-normal">/100</span>
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              (avgConviction <= 10 ? avgConviction * 10 : avgConviction) >= 75
                ? 'bg-[#00D4AA]/10 text-[#00FFD0] border border-[#00D4AA]/20'
                : 'bg-[#1E293B] text-[#8B95A8]'
            }`}>
              {(avgConviction <= 10 ? avgConviction * 10 : avgConviction) >= 75 ? '✦ High Conviction' : 'Standard Core'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
