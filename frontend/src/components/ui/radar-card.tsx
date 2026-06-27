'use client'

import Link from 'next/link'
import { RadarResponse } from '@/lib/types'
import { Crown, Sparkles, Cpu, Dna, Bitcoin, Shield, Activity } from 'lucide-react'
import { useMemo } from 'react'

const ICON_MAP: Record<string, React.ElementType> = {
  crown: Crown,
  spark: Sparkles,
  microchip: Cpu,
  dna: Dna,
  bitcoin: Bitcoin,
  shield: Shield,
}

// Reusing some helpers for display
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

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length === 0) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const height = 24
  const width = 60

  let points = ""
  if (data.length === 1) {
    const y = height - ((data[0] - min) / range) * height
    points = `0,${y} ${width},${y}`
  } else {
    points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - ((val - min) / range) * height
      return `${x},${y}`
    }).join(' ')
  }

  return (
    <svg width={width} height={height} className="overflow-visible" style={{ color }}>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {/* Show a glowing dot at the end */}
      {data.length > 0 && (
        <circle
          cx={width}
          cy={height - ((data[data.length - 1] - min) / range) * height}
          r="2"
          fill="currentColor"
          className="animate-pulse"
        />
      )}
    </svg>
  )
}

export default function RadarCard({
  radar,
}: {
  radar: RadarResponse
}) {
  const Icon = ICON_MAP[radar.icon] || Activity
  const vtName = `radar-${radar.slug}`

  // Extract sparkline data
  const trendData = useMemo(() => {
    return radar.trend.map(t => t.aura_score).reverse()
  }, [radar.trend])

  // Get Top Pick
  const topPlay = useMemo(() => {
    if (!radar.plays || radar.plays.length === 0) return null
    return [...radar.plays].sort((a, b) => b.aura_score - a.aura_score)[0]
  }, [radar.plays])

  return (
    <Link
      href={`/radars/${radar.slug}`}
      className="group relative flex flex-col min-w-[280px] w-full p-5 sm:p-6 md:p-8 rounded-[24px] bg-[#141B2D]/60 backdrop-blur-xl border border-white/5 transition-all duration-500 hover:-translate-y-1 hover:border-white/10 hover:shadow-2xl overflow-hidden snap-start"
      style={{ viewTransitionName: vtName } as any}
    >
      {/* Ambient Aura Background */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-1000 pointer-events-none"
        style={{
          background: `radial-gradient(circle at top right, ${radar.theme_color} 0%, transparent 70%)`
        }}
      />

      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex flex-col mb-5 md:mb-6 relative">
          <div className="flex items-center gap-3 mb-2 md:mb-3 pr-8">
            <div className="p-2.5 md:p-3 rounded-xl md:rounded-2xl bg-[#1E293B]/50 border border-white/5" style={{ color: radar.theme_color }}>
              <Icon className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl md:text-3xl tracking-tight font-black text-[#F1F5F9] font-[family-name:var(--font-geist-sans)]">
              {radar.name}
            </h2>
          </div>
          <p className="text-xs md:text-sm text-[#8B95A8] leading-relaxed line-clamp-2 max-w-[90%]">
            {radar.description}
          </p>
          <div className="absolute top-0 right-0 text-[#64748B] group-hover:text-[#F1F5F9] transition-colors">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform md:w-6 md:h-6"
            >
              <path d="M7 17l9.2-9.2M17 17V7H7" />
            </svg>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex flex-col gap-3 md:gap-4 mb-5 md:mb-6">
          <div className="flex justify-between items-end gap-3 md:gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-[9px] md:text-[10px] text-[#64748B] uppercase tracking-wider font-[family-name:var(--font-geist-mono)] mb-1 flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse shrink-0" />
                <span className="truncate">Aura Score (30d Signal)</span>
              </div>
              <div className="text-4xl md:text-5xl font-black font-[family-name:var(--font-geist-mono)] text-[#F1F5F9] flex items-baseline gap-1">
                {radar.aura_score}
              </div>
            </div>

            <div className="border-l border-white/5 pl-3 md:pl-4 text-left shrink-0">
              <div className="text-[9px] md:text-[10px] text-[#64748B] uppercase tracking-widest font-[family-name:var(--font-geist-mono)] mb-1 whitespace-nowrap">
                Omni (All-Time)
              </div>
              <div className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-geist-mono)] text-[#8B95A8]">
                {radar.omni_score}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/5 pt-3 md:pt-4">
            <div className="text-[9px] md:text-[10px] text-[#64748B] uppercase tracking-widest font-[family-name:var(--font-geist-mono)]">30 Days Trend</div>
            <Sparkline data={trendData} color={radar.theme_color} />
          </div>
        </div>

        {/* Top Pick Highlight */}
        {topPlay && topPlay.recent_mentions > 0 && (
          <div className="mb-5 md:mb-6 relative group/pick">
            {/* Extremely subtle ambient background glow */}
            <div 
              className="absolute top-0 left-0 bottom-0 w-1/2 rounded-xl opacity-[0.03] blur-[15px] transition-opacity duration-500 group-hover/pick:opacity-[0.08] pointer-events-none"
              style={{ backgroundColor: radar.theme_color }}
            />
            
            {/* Card surface */}
            <div 
              className="relative bg-[#0A0F1A]/40 backdrop-blur-md rounded-xl p-2.5 md:p-3 border flex items-center gap-2 md:gap-3 transition-all duration-300 group-hover/pick:bg-[#0A0F1A]/60"
              style={{ borderColor: 'rgba(255,255,255,0.04)' }}
            >
              {/* Refined Ticker Badge */}
              <div className="relative shrink-0 overflow-hidden rounded-md border border-white/5">
                <div 
                  className="absolute inset-0 opacity-20"
                  style={{ backgroundColor: radar.theme_color }}
                />
                <div className="relative text-[10px] md:text-xs font-bold px-2 py-1 flex items-center gap-1.5 font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">
                  <Sparkles size={12} strokeWidth={2} style={{ color: radar.theme_color }} className="hidden sm:block" />
                  {topPlay.ticker}
                </div>
              </div>

              {/* Mentions */}
              <div className="text-[10px] md:text-xs text-[#8B95A8] truncate flex-1 flex items-center gap-1.5">
                <span className="hidden sm:inline font-medium text-[#CBD5E1]">Top Pick</span>
                <span className="sm:hidden font-medium text-[#CBD5E1]">Pick</span>
                <span className="w-1 h-1 rounded-full bg-[#334155] shrink-0" /> 
                <span className="truncate">{topPlay.recent_mentions}x <span className="hidden sm:inline">mentions</span></span>
              </div>

              {/* Score Badge */}
              <div className="relative shrink-0 text-xs md:text-sm font-bold text-[#00D4AA] font-[family-name:var(--font-geist-mono)] bg-[#00D4AA]/5 px-2.5 py-0.5 rounded-md border border-[#00D4AA]/20">
                {topPlay.aura_score}
              </div>
            </div>
          </div>
        )}

        {/* Constituents Preview */}
        <div className="mb-5 md:mb-6">
          <div 
            className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            style={{ maskImage: 'linear-gradient(to right, black 90%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, black 90%, transparent 100%)' }}
          >
            {radar.tickers.map((tickerSymbol) => {
              // Find if this ticker is in the actual plays (meaning it has data)
              const hasData = radar.plays.some(p => p.ticker === tickerSymbol)
              return (
                <span
                  key={tickerSymbol}
                  className={`text-[9px] md:text-[10px] font-[family-name:var(--font-geist-mono)] px-2 py-1 rounded-md border transition-colors shrink-0 ${hasData
                      ? 'bg-[#1E293B]/50 border-[#2D3A4F] text-[#F1F5F9] group-hover:border-white/10'
                      : 'bg-transparent border-white/5 text-[#475569]'
                    }`}
                >
                  {tickerSymbol}
                </span>
              )
            })}
          </div>
        </div>

        {/* Pulse Bar Footer */}
        <div className="mt-auto pt-4 border-t border-white/5 flex flex-col gap-2">
          <div className="flex justify-between items-end">
            <span className={getSentimentBadgeClass(radar.sentiment_pulse)}>
              {getSentimentLabel(radar.sentiment_pulse)}
            </span>
            <div className="text-[9px] md:text-[10px] font-[family-name:var(--font-geist-mono)] text-[#64748B]">
              {radar.volume}x Mentions
            </div>
          </div>
          <PulseBar value={radar.sentiment_pulse} />
        </div>
      </div>
    </Link>
  )
}
