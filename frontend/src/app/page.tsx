'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Activity } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import HolographicCard from '@/components/HolographicCard'
import EKGHeartbeat from '@/components/EKGHeartbeat'
import RadarCard from '@/components/ui/radar-card'
import { RecommendationRow, AggregatedTicker, RadarResponse } from '@/lib/types'
import { TickerRow, PulseBar, getSentimentBadgeClass, getSentimentLabel } from '@/components/TickerRow'

function aggregateRecommendations(
  recommendations: RecommendationRow[]
): AggregatedTicker[] {
  const grouped = new Map<
    string,
    { sentiments: { value: number; weight: number }[]; prices: number[]; convictions: number[]; count: number; channels: Set<string>; stock_name: string }
  >()

  for (const rec of recommendations) {
    const ticker = rec.ticker
    if (!grouped.has(ticker)) {
      grouped.set(ticker, { sentiments: [], prices: [], convictions: [], count: 0, channels: new Set(), stock_name: rec.stock_name || '' })
    }
    const group = grouped.get(ticker)!
    const trustWeight = rec.videos.channels.trust_weight
    group.sentiments.push({ value: rec.sentiment, weight: trustWeight })
    if (rec.target_price !== null) {
      group.prices.push(rec.target_price)
    }
    group.convictions.push(rec.conviction_level)
    group.channels.add(rec.videos.channel_id)
    group.count++
    if (rec.stock_name && !group.stock_name) {
      group.stock_name = rec.stock_name
    }
  }

  const results: AggregatedTicker[] = []

  for (const [ticker, group] of grouped) {
    const weightedSum = group.sentiments.reduce((sum, s) => sum + s.value * s.weight, 0)
    const totalWeight = group.sentiments.reduce((sum, s) => sum + s.weight, 0)
    const rawSentiment = totalWeight > 0 ? weightedSum / totalWeight : 0
    const confidence = Math.min(group.count / 3, 1)
    const consensus_sentiment = Math.round(rawSentiment * confidence * 100) / 100

    const avg_target_price =
      group.prices.length > 0
        ? group.prices.reduce((sum, p) => sum + p, 0) / group.prices.length
        : null

    const avg_conviction = group.convictions.reduce((s, c) => s + c, 0) / group.convictions.length

    results.push({ ticker, stock_name: group.stock_name, consensus_sentiment, avg_target_price, avg_conviction, mention_count: group.count, analyst_count: group.channels.size })
  }

  results.sort((a, b) => b.mention_count - a.mention_count)
  return results
}

function MarketPulse({ aggregated }: { aggregated: AggregatedTicker[] }) {
  if (aggregated.length === 0) return null

  const totalMentions = aggregated.reduce((s, t) => s + t.mention_count, 0)
  const overallSentiment = totalMentions > 0
    ? aggregated.reduce((s, t) => s + t.consensus_sentiment * t.mention_count, 0) / totalMentions
    : 0

  const moodConfig = useMemo(() => {
    if (overallSentiment >= 1.0) {
      return {
        color: 'text-[#00D4AA] drop-shadow-[0_0_10px_rgba(0,212,170,0.3)]',
        glow: 'from-[#00D4AA]/20 to-[#00FFD0]/5',
        title: 'Extreme Bullish',
        byline: "Unwavering upside consensus. Analyst pipelines are loaded with green indicators.",
        scoreText: 'Very Bullish Bias',
        direction: 'BUY' as const
      }
    } else if (overallSentiment >= 0.3) {
      return {
        color: 'text-[#00D4AA]',
        glow: 'from-[#00D4AA]/15 to-[#00D4AA]/5',
        title: 'Bullish Momentum',
        byline: "Clear buy bias. Market sentiment leans towards growth indicators today.",
        scoreText: 'Bullish Bias',
        direction: 'BUY' as const
      }
    } else if (overallSentiment <= -1.0) {
      return {
        color: 'text-[#FF4D6A] drop-shadow-[0_0_10px_rgba(255,77,106,0.3)]',
        glow: 'from-[#FF4D6A]/20 to-[#FF1744]/5',
        title: 'Extreme Bearish',
        byline: "Severe downside conviction. Defensive hedging is highly recommended.",
        scoreText: 'Very Bearish Bias',
        direction: 'SELL' as const
      }
    } else if (overallSentiment <= -0.3) {
      return {
        color: 'text-[#FF4D6A]',
        glow: 'from-[#FF4D6A]/15 to-[#FF4D6A]/5',
        title: 'Bearish Bias',
        byline: "Under pressure. Sellers outpace buyers in latest transcripts.",
        scoreText: 'Bearish Bias',
        direction: 'SELL' as const
      }
    } else {
      return {
        color: 'text-[#8B95A8]',
        glow: 'from-[#8B95A8]/10 to-[#141B2D]/5',
        title: 'Mixed Signals',
        byline: "Tug-of-war. Bulls and Bears are divided on short term direction.",
        scoreText: 'Neutral State',
        direction: 'NEUTRAL' as const
      }
    }
  }, [overallSentiment])

  const buckets = { strongBuy: 0, buy: 0, neutral: 0, sell: 0, strongSell: 0 }
  for (const t of aggregated) {
    if (t.consensus_sentiment >= 1.5) buckets.strongBuy++
    else if (t.consensus_sentiment >= 0.5) buckets.buy++
    else if (t.consensus_sentiment > -0.5) buckets.neutral++
    else if (t.consensus_sentiment > -1.5) buckets.sell++
    else buckets.strongSell++
  }
  const total = aggregated.length

  return (
    <section className="relative rounded-3xl border border-[#1E293B] bg-[#141B2D]/45 overflow-hidden mb-8 p-6 md:p-10 transition-all duration-500 shadow-xl shadow-black/30 animate-fade-up stagger-1">
      <div className={`absolute top-0 right-1/4 w-[300px] h-[300px] rounded-full blur-[110px] pointer-events-none bg-gradient-to-br ${moodConfig.glow} opacity-60 transition-all duration-1000`} />
      
      <EKGHeartbeat overallMood={moodConfig.title} direction={moodConfig.direction} />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Activity className={`w-3.5 h-3.5 ${moodConfig.direction === 'SELL' ? 'text-[#FF4D6A]' : moodConfig.direction === 'BUY' ? 'text-[#00D4AA]' : 'text-[#8B95A8]'} animate-pulse`} />
            <h1 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#64748B] font-[family-name:var(--font-geist-mono)]">
              Market Pulse
            </h1>
          </div>
          
          <div className="mt-3">
            <div className="flex items-center gap-4 flex-wrap">
              <span className={`text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter ${moodConfig.color} transition-all duration-1000 leading-none`}>
                {moodConfig.title}
              </span>
              <span className="text-sm md:text-lg text-[#64748B] font-bold font-[family-name:var(--font-geist-mono)] bg-[#0A0F1A]/80 border border-[#1E293B] px-4 py-2 md:px-5 md:py-2.5 rounded-xl">
                {moodConfig.scoreText}
              </span>
            </div>
            <p className="text-xs md:text-sm text-[#8B95A8] mt-3 max-w-xl leading-relaxed">
              {moodConfig.byline}
            </p>
            <div className="mt-4">
              <Link 
                href="/today" 
                className="inline-flex items-center gap-1.5 text-xs text-[#00D4AA] hover:text-[#00FFD0] font-bold tracking-wider uppercase font-[family-name:var(--font-geist-mono)] transition-all duration-300 group/pulse-link"
              >
                <span>View Today's Plays Detail</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transform group-hover/pulse-link:translate-x-1 transition-transform">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 md:gap-5 bg-[#0A0F1A]/80 border border-[#1E293B] rounded-3xl p-6 md:p-8 shrink-0 self-start md:self-auto font-[family-name:var(--font-geist-mono)] shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] w-full md:w-[450px] lg:w-[500px]">
           <div className="flex justify-between text-[11px] md:text-sm uppercase tracking-widest text-[#64748B] mb-1">
             <span>Bullish</span>
             <span>Bearish</span>
           </div>
           <div className="flex w-full h-6 md:h-8 rounded-full overflow-hidden bg-[#1E293B] shadow-inner">
             {buckets.strongBuy > 0 && <div className="h-full bg-[#00FFD0] transition-all duration-1000" style={{ width: `${(buckets.strongBuy / total) * 100}%` }} />}
             {buckets.buy > 0 && <div className="h-full bg-[#00D4AA] transition-all duration-1000" style={{ width: `${(buckets.buy / total) * 100}%` }} />}
             {buckets.neutral > 0 && <div className="h-full bg-[#475569] transition-all duration-1000" style={{ width: `${(buckets.neutral / total) * 100}%` }} />}
             {buckets.sell > 0 && <div className="h-full bg-[#FF4D6A] transition-all duration-1000" style={{ width: `${(buckets.sell / total) * 100}%` }} />}
             {buckets.strongSell > 0 && <div className="h-full bg-[#FF1744] transition-all duration-1000" style={{ width: `${(buckets.strongSell / total) * 100}%` }} />}
           </div>
           <div className="flex justify-between items-center text-sm md:text-base mt-2">
             <span className="text-[#00D4AA] font-black tracking-wide">{buckets.strongBuy + buckets.buy} <span className="text-[#64748B] font-bold text-xs md:text-sm">signals</span></span>
             <span className="text-[#8B95A8] font-black tracking-wide">{buckets.neutral} <span className="text-[#64748B] font-bold text-xs md:text-sm">neutral</span></span>
             <span className="text-[#FF4D6A] font-black tracking-wide">{buckets.sell + buckets.strongSell} <span className="text-[#64748B] font-bold text-xs md:text-sm">signals</span></span>
           </div>
        </div>
      </div>
    </section>
  )
}

function SpotlightCards({ aggregated }: { aggregated: AggregatedTicker[] }) {
  if (aggregated.length < 2) return null
  const qualified = aggregated.filter(t => t.mention_count >= 3)
  if (qualified.length === 0) return null

  const cards: { label: string; icon: string; ticker: AggregatedTicker; glowTheme: string; textTheme: string; gradient: string }[] = []
  const seen = new Set<string>()

  const addCard = (label: string, icon: string, ticker: AggregatedTicker) => {
    if (!ticker || seen.has(ticker.ticker)) return false
    
    let glowTheme, textTheme, gradient
    if (ticker.consensus_sentiment >= 0.5) {
      glowTheme = 'hover:shadow-[0_10px_30px_-10px_rgba(0,212,170,0.3)] hover:border-[#00D4AA]/40'
      textTheme = 'text-[#00D4AA]'
      gradient = 'from-[#00D4AA]/10 via-transparent to-transparent'
    } else if (ticker.consensus_sentiment <= -0.5) {
      glowTheme = 'hover:shadow-[0_10px_30px_-10px_rgba(255,77,106,0.3)] hover:border-[#FF4D6A]/40'
      textTheme = 'text-[#FF4D6A]'
      gradient = 'from-[#FF4D6A]/10 via-transparent to-transparent'
    } else {
      glowTheme = 'hover:shadow-[0_10px_30px_-10px_rgba(241,245,249,0.2)] hover:border-[#F1F5F9]/30'
      textTheme = 'text-[#F1F5F9]'
      gradient = 'from-[#F1F5F9]/5 via-transparent to-transparent'
    }

    cards.push({ label, icon, ticker, glowTheme, textTheme, gradient })
    seen.add(ticker.ticker)
    return true
  }

  const bestBull = [...qualified].filter(t => t.consensus_sentiment > 0.5).sort((a, b) => b.avg_conviction - a.avg_conviction)[0]
  if (bestBull) addCard('Highest Conviction', '◎', bestBull)

  let bestBear = [...qualified].filter(t => t.consensus_sentiment <= -0.5).sort((a, b) => a.consensus_sentiment - b.consensus_sentiment)[0]
  if (!bestBear) {
    bestBear = [...aggregated].filter(t => t.consensus_sentiment <= -0.5).sort((a, b) => a.consensus_sentiment - b.consensus_sentiment)[0]
  }
  if (bestBear) addCard('Most Bearish', '◌', bestBear)

  const mostMentioned = [...qualified].sort((a, b) => b.mention_count - a.mention_count)
  for (const t of mostMentioned) {
    if (cards.length >= 3) break
    addCard(cards.length === 1 ? 'Viral Momentum' : 'Trending Now', '◉', t)
  }

  if (cards.length === 0) return null

  const gridCols = cards.length === 3 ? 'md:grid-cols-3' : cards.length === 2 ? 'md:grid-cols-2 max-w-4xl' : 'max-w-md'

  return (
    <div className={`grid gap-4 ${gridCols} animate-fade-up stagger-2 mb-8`}>
      {cards.map(({ label, icon, ticker, glowTheme, textTheme, gradient }) => {
        return (
          <Link
            key={ticker.ticker}
            href={`/ticker?s=${ticker.ticker}`}
            className={`group relative flex flex-col p-5 rounded-2xl bg-[#141B2D]/40 backdrop-blur-md border border-[#ffffff]/5 ${glowTheme} transition-all duration-500 ease-out hover:-translate-y-1 overflow-hidden`}
          >
            <div className={`absolute -inset-10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] ${gradient} pointer-events-none`} />
            
            <div className="flex items-center gap-2 mb-3 relative z-10">
              <span className={`text-sm ${textTheme} opacity-80 group-hover:opacity-100 transition-opacity`}>{icon}</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-[#64748B] font-medium">{label}</span>
            </div>

            <div className="flex items-baseline gap-3 mb-2 relative z-10">
              <h2 className={`font-[family-name:var(--font-geist-mono)] text-3xl font-bold ${textTheme} tracking-wide group-hover:scale-105 transform origin-left transition-transform duration-500`}>
                {ticker.ticker}
              </h2>
            </div>
            
            <div className="flex items-center gap-3 mt-auto pt-2 relative z-10">
              <span className={getSentimentBadgeClass(ticker.consensus_sentiment)}>
                {getSentimentLabel(ticker.consensus_sentiment)}
              </span>
              <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                <span className="w-1 h-1 rounded-full bg-[#64748B]" />
                <span className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[#8B95A8]">
                  {ticker.mention_count} Mentions
                </span>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function TrendingRadars({ radars }: { radars: RadarResponse[] }) {
  if (!radars || radars.length === 0) return null

  return (
    <div className="mb-8 animate-fade-up stagger-3">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#F59E0B]" />
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[#E2E8F0] font-[family-name:var(--font-geist-mono)]">
            Trending Radars
          </h2>
        </div>
        <Link 
          href="/radars" 
          className="text-xs text-[#00D4AA] hover:text-[#00FFD0] font-semibold tracking-wide flex items-center gap-1 transition-colors group/radar-link"
        >
          <span>View All Radars</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transform group-hover/radar-link:translate-x-0.5 transition-transform">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </Link>
      </div>
      
      <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 md:grid md:grid-cols-2 lg:grid-cols-3 hide-scrollbar">
        {radars.map(radar => (
          <RadarCard key={radar.slug} radar={radar} />
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const [aggregated, setAggregated] = useState<AggregatedTicker[]>([])
  const [radars, setRadars] = useState<RadarResponse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient()

        const [recsRes, radarsRes] = await Promise.all([
          supabase
            .from("recommendations")
            .select(`
              ticker,
              stock_name,
              sentiment,
              target_price,
              conviction_level,
              videos!inner(
                channel_id,
                channels!inner(trust_weight)
              )
            `),
          fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/v1/radars`)
            .then(res => res.ok ? res.json() : [])
            .catch(() => [])
        ])

        const agg = recsRes.data
          ? aggregateRecommendations(recsRes.data as unknown as RecommendationRow[])
          : []
        setAggregated(agg)
        setRadars(radarsRes)
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div
            className="absolute glow-emerge"
            style={{ width: '320px', height: '320px', animationDelay: '600ms' }}
          >
            <div className="aura-glow" />
            <div className="aura-glow-inner" />
          </div>
          <div className="relative text-center">
            <div className="text-8xl md:text-9xl font-extralight tracking-[0.25em] logo-sweep">
              {'aura'.split('').map((letter, i) => (
                <span
                  key={i}
                  className="logo-letter letter-materialize"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  {letter}
                </span>
              ))}
            </div>
            <a
              href="https://bynoor.io"
              target="_blank"
              rel="noopener noreferrer"
              className="byline-appear inline-block mt-4 text-sm font-light text-[#64748B] hover:text-[#00D4AA] transition-colors duration-300 tracking-[0.15em]"
              style={{ animationDelay: '700ms' }}
            >
              by noor
            </a>
          </div>
        </div>
      </div>
    )
  }

  // Pre-calculate curated lists for the homepage
  const mostDiscussed = [...aggregated].sort((a, b) => b.mention_count - a.mention_count).slice(0, 5)
  const highestConviction = [...aggregated].sort((a, b) => b.avg_conviction - a.avg_conviction).slice(0, 5)
  const topTicker = aggregated.find(t => t.mention_count >= 3 && t.consensus_sentiment > 0)?.ticker

  return (
    <div className="relative min-h-screen px-4 py-8 md:px-8 md:py-12 bg-[#0A0F1A] overflow-hidden">
      <div 
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.015] mix-blend-overlay" 
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />
      
      <div className="relative z-10 w-full max-w-[1400px] mx-auto">
        <header className="mb-16 md:mb-20 pt-8 md:pt-16">
          <div className="relative flex flex-col items-center mb-8 md:mb-10">
            <div
              className="absolute w-[320px] h-[240px] md:w-[500px] md:h-[320px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 glow-emerge"
              style={{ animationDelay: '600ms' }}
            >
              <div className="aura-glow" />
              <div className="aura-glow-inner" />
            </div>

            <h1 className="relative text-8xl md:text-9xl lg:text-[11rem] font-extralight tracking-[0.2em] md:tracking-[0.25em] logo-sweep leading-none">
              {'aura'.split('').map((letter, i) => (
                <span
                  key={i}
                  className="logo-letter letter-materialize"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  {letter}
                </span>
              ))}
            </h1>

            <a
              href="https://bynoor.io"
              target="_blank"
              rel="noopener noreferrer"
              className="relative mt-3 md:mt-4 text-sm font-light text-[#64748B] hover:text-[#00D4AA] transition-colors duration-300 tracking-[0.15em] byline-appear"
              style={{ animationDelay: '800ms' }}
            >
              by noor
            </a>
          </div>

          <div className="text-center animate-hero-rise flex flex-col items-center gap-6 mt-2" style={{ animationDelay: '900ms' }}>
            <div className="flex flex-col items-center gap-4">
              <h2 className="text-2xl md:text-4xl font-medium tracking-tight text-[#E2E8F0]">
                Every stock analyst. One clear signal.
              </h2>
              <p className="text-lg md:text-xl text-[#8B95A8] font-light leading-relaxed max-w-2xl">
                Discover market-moving conviction by tracking real-time sentiment across top YouTube finance channels.
              </p>
            </div>
            
            {/* Quick Navigation Pills */}
            <div className="flex flex-wrap justify-center gap-3">
              <Link 
                href="/today" 
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#141B2D]/60 hover:bg-[#1E293B]/80 border border-[#1E293B] hover:border-[#00D4AA]/30 text-xs font-semibold text-[#8B95A8] hover:text-[#00D4AA] transition-all duration-300 shadow-inner group/pill-today"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse" />
                <span>Today's Plays</span>
              </Link>
              <Link 
                href="/explore" 
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#141B2D]/60 hover:bg-[#1E293B]/80 border border-[#1E293B] hover:border-[#00D4AA]/30 text-xs font-semibold text-[#8B95A8] hover:text-[#00D4AA] transition-all duration-300 shadow-inner group/pill-explore"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#64748B]" />
                <span>Explorer</span>
              </Link>
              <Link 
                href="/radars" 
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#141B2D]/60 hover:bg-[#1E293B]/80 border border-[#1E293B] hover:border-[#F59E0B]/30 text-xs font-semibold text-[#8B95A8] hover:text-[#F59E0B] transition-all duration-300 shadow-inner group/pill-radars"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                <span>Radars</span>
              </Link>
            </div>
          </div>

          {aggregated.length > 0 && (
            <div className="mt-10 md:mt-12 relative h-px animate-hero-rise" style={{ animationDelay: '1200ms' }}>
              <div className="absolute inset-0 bg-[#1E293B]" />
              <div className="absolute inset-0 h-px bg-gradient-to-r from-transparent via-[#00D4AA] to-transparent hero-pulse-line" />
            </div>
          )}
        </header>

        {aggregated.length > 0 && (
          <div className="mb-6">
            <MarketPulse aggregated={aggregated} />
          </div>
        )}

        {aggregated.length > 0 && (
          <div className="mb-6">
            <SpotlightCards aggregated={aggregated} />
          </div>
        )}

        {radars.length > 0 && (
          <div className="mb-10">
            <TrendingRadars radars={radars} />
          </div>
        )}

        {/* Curated Previews */}
        {aggregated.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 animate-fade-up stagger-4">
            {/* Most Discussed */}
            <div>
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#00D4AA]" />
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[#E2E8F0] font-[family-name:var(--font-geist-mono)]">
                    Most Discussed
                  </h2>
                </div>
              </div>
              <div className="space-y-3">
                {mostDiscussed.map((row, index) => (
                  <TickerRow key={row.ticker} row={row} index={index} isTop={row.ticker === topTicker} compact={true} />
                ))}
              </div>
            </div>

            {/* Highest Conviction */}
            <div>
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-[#00D4AA]">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <circle cx="12" cy="12" r="4" fill="currentColor" />
                  </svg>
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[#E2E8F0] font-[family-name:var(--font-geist-mono)]">
                    Highest Conviction
                  </h2>
                </div>
              </div>
              <div className="space-y-3">
                {highestConviction.map((row, index) => (
                  <TickerRow key={row.ticker} row={row} index={index} isTop={false} compact={true} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Explore CTA */}
        {aggregated.length > 0 && (
          <div className="text-center animate-fade-up stagger-5 py-8">
             <Link 
               href="/explore" 
               className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA] font-bold tracking-wide hover:bg-[#00D4AA]/20 hover:scale-105 transition-all duration-300 shadow-[0_0_20px_rgba(0,212,170,0.15)] hover:shadow-[0_0_30px_rgba(0,212,170,0.3)]"
             >
               <span>Explore All Data</span>
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                 <path d="M5 12h14" />
                 <path d="m12 5 7 7-7 7" />
               </svg>
             </Link>
          </div>
        )}

        {aggregated.length > 0 && (
          <footer className="mt-12 pt-6 border-t border-[#1E293B] animate-fade-up stagger-10">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-[#64748B] leading-relaxed">
                Trust-weighted consensus · <span className="text-[#8B95A8]">*</span> fewer than 3 mentions
              </p>
              <p className="font-[family-name:var(--font-geist-mono)] text-[11px] text-[#475569] tracking-wide">
                <span className="text-[#64748B]">{aggregated.length}</span> total tickers tracked
              </p>
            </div>
          </footer>
        )}
      </div>
    </div>
  )
}
