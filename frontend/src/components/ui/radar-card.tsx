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
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((val - min) / range) * height
    return `${x},${y}`
  }).join(' ')

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
    return [...radar.plays].sort((a,b) => b.aura_score - a.aura_score)[0]
  }, [radar.plays])

  return (
    <Link
      href={`/radars/${radar.slug}`}
      className="group relative flex flex-col min-w-[280px] w-full p-8 rounded-3xl bg-[#141B2D]/60 backdrop-blur-xl border border-white/5 transition-all duration-500 hover:-translate-y-1 hover:border-white/10 hover:shadow-2xl overflow-hidden snap-start"
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
        <div className="flex flex-col mb-6 relative">
          <div className="flex items-center gap-3 mb-3 pr-8">
             <div className="p-3 rounded-2xl bg-[#1E293B]/50 border border-white/5" style={{ color: radar.theme_color }}>
                <Icon size={24} strokeWidth={2.5} />
             </div>
             <h2 className="text-3xl tracking-tight font-black text-[#F1F5F9] font-[family-name:var(--font-geist-sans)]">
                {radar.name}
             </h2>
          </div>
          <p className="text-sm text-[#8B95A8] leading-relaxed line-clamp-2 max-w-[90%]">
             {radar.description}
          </p>
          <div className="absolute top-0 right-0 text-[#64748B] group-hover:text-[#F1F5F9] transition-colors">
            <svg
              width="24"
              height="24"
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

        {/* Stats Row */}
        <div className="flex flex-col gap-4 mb-6">
           <div className="grid grid-cols-2 gap-4 items-end">
             <div>
                <div className="text-[10px] text-[#64748B] uppercase tracking-widest font-[family-name:var(--font-geist-mono)] mb-1 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse" />
                  Aura Score
                </div>
                <div className="text-5xl font-black font-[family-name:var(--font-geist-mono)] text-[#F1F5F9] flex items-baseline gap-1">
                   {radar.aura_score}
                </div>
             </div>
             
             <div className="border-l border-white/5 pl-4 text-left">
                <div className="text-[10px] text-[#64748B] uppercase tracking-widest font-[family-name:var(--font-geist-mono)] mb-1">
                  Omni (All-Time)
                </div>
                <div className="text-3xl font-bold font-[family-name:var(--font-geist-mono)] text-[#8B95A8]">
                   {radar.omni_score}
                </div>
             </div>
           </div>
           
           <div className="flex items-center justify-between border-t border-white/5 pt-4">
              <div className="text-[10px] text-[#64748B] uppercase tracking-widest font-[family-name:var(--font-geist-mono)]">30 Days Trend</div>
              <Sparkline data={trendData} color={radar.theme_color} />
           </div>
        </div>

        {/* Top Pick Highlight */}
        {topPlay && topPlay.recent_mentions > 0 && (
          <div className="mb-6 bg-[#0A0F1A]/50 rounded-xl p-3 border border-white/5 flex items-center gap-3">
             <div className="text-xs font-bold text-[#F1F5F9] px-2 py-1 bg-[#1E293B] rounded-md border border-[#2D3A4F] font-[family-name:var(--font-geist-mono)]">
               {topPlay.ticker}
             </div>
             <div className="text-xs text-[#8B95A8] truncate flex-1">
               Top Pick &middot; {topPlay.recent_mentions} mentions
             </div>
             <div className="text-sm font-bold text-[#00D4AA] font-[family-name:var(--font-geist-mono)]">
               {topPlay.aura_score}
             </div>
          </div>
        )}

        {/* Constituents Preview */}
        <div className="mb-6 flex flex-wrap gap-1.5">
          {radar.tickers.map((tickerSymbol) => {
            // Find if this ticker is in the actual plays (meaning it has data)
            const hasData = radar.plays.some(p => p.ticker === tickerSymbol)
            return (
              <span
                key={tickerSymbol}
                className={`text-[10px] font-[family-name:var(--font-geist-mono)] px-2 py-1 rounded-md border transition-colors ${
                  hasData
                    ? 'bg-[#1E293B]/50 border-[#2D3A4F] text-[#F1F5F9] group-hover:border-white/10'
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
            <span className={getSentimentBadgeClass(radar.sentiment_pulse)}>
              {getSentimentLabel(radar.sentiment_pulse)}
            </span>
            <div className="text-[10px] font-[family-name:var(--font-geist-mono)] text-[#64748B]">
              {radar.volume} Mentions
            </div>
          </div>
          <PulseBar value={radar.sentiment_pulse} />
        </div>
      </div>
    </Link>
  )
}
