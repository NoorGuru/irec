'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { RadarResponse } from '@/lib/types'
import { Crown, Sparkles, Cpu, Dna, Bitcoin, Shield, Activity, ArrowLeft, Target, MessageCircle, Cloud, Sun, DollarSign, CreditCard, Globe, Lock, Satellite } from 'lucide-react'
import Loading from '@/components/ui/loading'

const ICON_MAP: Record<string, React.ElementType> = {
  crown: Crown,
  spark: Sparkles,
  microchip: Cpu,
  dna: Dna,
  bitcoin: Bitcoin,
  shield: Shield,
  processor: Cpu,
  cloud: Cloud,
  sun: Sun,
  dollar: DollarSign,
  creditCard: CreditCard,
  globe: Globe,
  lock: Lock,
  satellite: Satellite,
}

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

function LargeSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length === 0) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const height = 100
  const width = 300

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
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible drop-shadow-2xl" style={{ color }}>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {data.length > 0 && (
        <circle
          cx={width}
          cy={height - ((data[data.length - 1] - min) / range) * height}
          r="4"
          fill="currentColor"
          className="animate-pulse"
        />
      )}
    </svg>
  )
}

function ConvictionMini({ level }: { level: number }) {
  const rounded = Math.round(level)
  return (
    <div className="flex items-center gap-1" title={`Conviction: ${level.toFixed(1)}/10`}>
      <div className="flex gap-[2px]">
        {Array.from({ length: 5 }, (_, i) => {
          const filled = i < Math.round(rounded / 2)
          return (
            <div
              key={i}
              className={`w-1 h-3 rounded-[1px] ${filled ? 'bg-[#00D4AA]' : 'bg-[#1E293B]'}`}
            />
          )
        })}
      </div>
      <span className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[#64748B]">
        {level.toFixed(1)}
      </span>
    </div>
  )
}

export default function RadarDetailClient({ slug }: { slug: string }) {
  const [radar, setRadar] = useState<RadarResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/v1/radars/${slug}`)
        if (res.ok) {
          const data = await res.json()
          setRadar(data)
        }
      } catch (e) {
        console.error("Failed to fetch radar", e)
      }
      setLoading(false)
    }
    fetchData()
  }, [slug])

  const trendData = useMemo(() => {
    if (!radar) return []
    return radar.trend.map(t => t.aura_score).reverse()
  }, [radar])

  if (loading) {
    const formattedTitle = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    return <Loading title={formattedTitle} subtitle="Loading radar details..." />
  }

  if (!radar) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A0F1A] text-white">
        <h1 className="text-4xl mb-4 font-[family-name:var(--font-geist-mono)]">404</h1>
        <p className="text-[#8B95A8]">Radar not found</p>
        <Link href="/radars" className="mt-8 text-[#00D4AA] hover:underline">Return to Radars</Link>
      </div>
    )
  }

  const Icon = ICON_MAP[radar.icon] || Activity
  const vtName = `radar-${radar.slug}`

  return (
    <main className="min-h-screen bg-[#0A0F1A] text-[#E2E8F0] p-4 md:p-8 font-[family-name:var(--font-geist-sans)] selection:bg-white/20">
      <div className="max-w-[1400px] w-full mx-auto pt-6 pb-20">

        <Link href="/radars" className="inline-flex items-center gap-2 text-sm text-[#64748B] hover:text-[#00D4AA] transition-colors mb-8 uppercase tracking-widest font-semibold">
          <ArrowLeft size={16} />
          All Radars
        </Link>

        {/* Hero Section */}
        <div
          className="relative rounded-[2rem] border border-white/5 bg-[#141B2D]/40 backdrop-blur-3xl overflow-hidden mb-12 p-8 md:p-12"
          style={{ viewTransitionName: vtName } as any}
        >
          {/* Giant ambient glow */}
          <div
            className="absolute -top-[50%] -right-[20%] w-[800px] h-[800px] rounded-full blur-[120px] pointer-events-none opacity-20"
            style={{ backgroundColor: radar.theme_color }}
          />

          <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-4 mb-6">
                <div className="p-4 rounded-2xl bg-[#1E293B]/80 border border-white/10 shadow-2xl" style={{ color: radar.theme_color }}>
                  <Icon size={40} strokeWidth={2} />
                </div>
                <div className="text-xs uppercase tracking-[0.3em] font-bold" style={{ color: radar.theme_color }}>
                  Curated Radar
                </div>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <span className="text-[12px] uppercase tracking-wider text-[#64748B] bg-[#1E293B]/50 px-3 py-1 rounded-md border border-[#2D3A4F]">
                  {radar.category}
                </span>
              </div>

              <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-[#F1F5F9] mb-4 drop-shadow-md">
                {radar.name}
              </h1>

              <p className="text-lg text-[#8B95A8] leading-relaxed max-w-lg mb-8">
                {radar.description}
              </p>

              <div className="flex flex-wrap gap-2">
                {radar.tickers.map((t) => (
                  <Link key={t} href={`/ticker?s=${t}`} className="px-3 py-1.5 rounded-lg bg-[#1E293B] border border-[#2D3A4F] text-xs font-[family-name:var(--font-geist-mono)] text-[#F1F5F9] hover:bg-[#2D3A4F] transition-colors">
                    {t}
                  </Link>
                ))}
              </div>
            </div>

            {/* Huge Stats Panel */}
            <div className="flex flex-col gap-6 bg-[#0A0F1A]/80 border border-[#1E293B] rounded-3xl p-8 shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]">

              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                  <div className="text-[10px] text-[#64748B] uppercase tracking-wider font-[family-name:var(--font-geist-mono)] mb-2 flex items-center gap-2 whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full bg-[#00D4AA] animate-pulse shrink-0" />
                    Aura Score (30 days signal)
                  </div>
                  <div className="text-6xl md:text-8xl font-black font-[family-name:var(--font-geist-mono)] text-[#F1F5F9] tracking-tighter flex items-baseline gap-2">
                    {radar.aura_score}
                    <span className="text-xl text-[#64748B] font-medium tracking-normal">/100</span>
                  </div>
                </div>

                <div className="text-left md:text-right border-l-2 md:border-l-0 md:border-r-2 border-[#1E293B] pl-4 md:pl-0 md:pr-4">
                  <div className="text-[10px] text-[#64748B] uppercase tracking-widest font-[family-name:var(--font-geist-mono)] mb-2">
                    All-Time Omni Score
                  </div>
                  <div className="text-4xl md:text-5xl font-black font-[family-name:var(--font-geist-mono)] text-[#8B95A8] tracking-tighter">
                    {radar.omni_score}
                  </div>
                </div>

                <div className="hidden lg:block text-right">
                  <div className="text-[10px] text-[#64748B] uppercase tracking-widest font-[family-name:var(--font-geist-mono)] mb-2">Signal</div>
                  <span className={getSentimentBadgeClass(radar.sentiment_pulse)}>
                    {getSentimentLabel(radar.sentiment_pulse)}
                  </span>
                </div>
              </div>

              <div className="pt-6 border-t border-[#1E293B]">
                <div className="text-[10px] text-[#64748B] uppercase tracking-widest font-[family-name:var(--font-geist-mono)] mb-4">30-Day Score Trend</div>
                <div className="h-24 w-full pr-4">
                  <LargeSparkline data={trendData} color={radar.theme_color} />
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Constituents Grid */}
        <h2 className="text-2xl font-black text-[#F1F5F9] mb-6 flex items-center gap-3">
          <Activity className="text-[#00D4AA]" size={24} />
          Radar Constituents
        </h2>

        {radar.plays.length === 0 ? (
          <div className="p-12 text-center text-[#8B95A8] bg-[#141B2D]/40 rounded-3xl border border-[#1E293B]">
            No active plays found for these constituents in the past 30 days.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {radar.plays.sort((a, b) => b.aura_score - a.aura_score).map(play => (
              <Link
                key={play.ticker}
                href={`/ticker?s=${play.ticker}`}
                className="group flex flex-col bg-[#141B2D]/60 hover:bg-[#1E293B]/80 border border-[#1E293B] hover:border-white/10 rounded-3xl overflow-hidden transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-2xl"
              >
                {/* Header: Ticker, Target Price, Mentions */}
                <div className="flex justify-between items-start p-6 pb-4 border-b border-white/5 bg-[#0A0F1A]/30">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-[family-name:var(--font-geist-mono)] text-2xl font-black text-[#F1F5F9] group-hover:text-[#00D4AA] transition-colors">
                        {play.ticker}
                      </span>
                      <span className={getSentimentBadgeClass(play.consensus_sentiment)}>
                        {play.action_label}
                      </span>
                    </div>
                    <span className="text-xs text-[#8B95A8] font-medium">{play.stock_name}</span>
                  </div>

                  <div className="flex flex-col items-end gap-2 text-right">
                    <div className="flex items-center gap-2 text-[#8B95A8] text-xs font-[family-name:var(--font-geist-mono)]">
                      <Target size={14} />
                      {play.avg_target_price ? `$${play.avg_target_price.toFixed(2)}` : 'N/A'}
                    </div>
                    <div className="flex items-center gap-2 text-[#8B95A8] text-xs font-[family-name:var(--font-geist-mono)]">
                      <MessageCircle size={14} />
                      {play.recent_mentions} <span className="text-[10px] text-[#64748B] uppercase">in 30 Days</span>
                    </div>
                  </div>
                </div>

                {/* Body: Catalyst and Conviction */}
                <div className="p-6 flex-grow flex flex-col gap-4">
                  <div className="flex justify-between items-center text-xs">
                    <div className="text-[#64748B]">
                      {play.recent_mentions > 0
                        ? `${play.analyst_count} analysts (${play.agreement_pct}% agree)`
                        : 'No recent analyst consensus'
                      }
                    </div>
                    {play.recent_mentions > 0 && (
                      <ConvictionMini level={play.avg_conviction} />
                    )}
                  </div>

                  <div className="bg-[#0A0F1A]/50 rounded-xl p-4 border border-white/5 text-sm text-[#8B95A8] italic line-clamp-3 leading-relaxed">
                    "{play.top_catalyst}"
                  </div>
                </div>

                {/* Footer: The Dual Scores */}
                <div className="grid grid-cols-2 divide-x divide-white/5 border-t border-white/5 bg-[#0A0F1A]/80">
                  <div className="p-5 flex flex-col items-center justify-center group-hover:bg-white/5 transition-colors">
                    <div className="text-[10px] text-[#64748B] uppercase tracking-wider font-[family-name:var(--font-geist-mono)] mb-1 flex items-center gap-1.5 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse shrink-0" />
                      Aura Score (30 days signal)
                    </div>
                    <div className="text-4xl font-black font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">
                      {play.aura_score}
                    </div>
                  </div>

                  <div className="p-5 flex flex-col items-center justify-center group-hover:bg-white/5 transition-colors">
                    <div className="text-[10px] text-[#64748B] uppercase tracking-widest font-[family-name:var(--font-geist-mono)] mb-1">
                      Omni Score (All-Time)
                    </div>
                    <div className="text-3xl font-bold font-[family-name:var(--font-geist-mono)] text-[#8B95A8]">
                      {play.omni_score}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
