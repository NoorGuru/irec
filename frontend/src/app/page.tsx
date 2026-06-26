'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import HolographicCard from '@/components/HolographicCard'
import EKGHeartbeat from '@/components/EKGHeartbeat'
import RadarCard from '@/components/ui/radar-card'
import { RecommendationRow, AggregatedTicker, RadarResponse } from '@/lib/types'

// ─── Types ───

type SortKey = 'mentions' | 'sentiment' | 'conviction' | 'alpha'

// ─── Aggregation Logic ───

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
    // Keep the most recent non-empty stock_name
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

// ─── Helpers ───

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

function getMarketLeanLabel(avg: number): { label: string; color: string } {
  if (avg >= 1.0) return { label: 'Very Bullish', color: 'sentiment-strong-buy' }
  if (avg >= 0.4) return { label: 'Bullish', color: 'text-[#00D4AA]' }
  if (avg > -0.4) return { label: 'Mixed', color: 'text-[#8B95A8]' }
  if (avg > -1.0) return { label: 'Bearish', color: 'text-[#FF4D6A]' }
  return { label: 'Very Bearish', color: 'sentiment-strong-sell' }
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '—'
  const diff = Date.now() - date.getTime()
  if (diff < 0) return '—'
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return '1d ago'
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Client-only time display to avoid hydration mismatch with static export */
function TimeAgo({ dateStr }: { dateStr: string }) {
  const [text, setText] = useState('')
  useEffect(() => {
    setText(timeAgo(dateStr))
  }, [dateStr])
  return <>{text}</>
}

function SentimentArrow({ value }: { value: number }) {
  if (value >= 1.5) {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="inline-block">
        <path d="M7 2L7 12M7 2L3 6M7 2L11 6" stroke="#00FFD0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  if (value <= -1.5) {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="inline-block">
        <path d="M7 12L7 2M7 12L3 8M7 12L11 8" stroke="#FF1744" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  return null
}

function sentimentToPercent(value: number): number {
  return ((value + 2) / 4) * 100
}

function PulseBar({ value, isTop }: { value: number; isTop: boolean }) {
  const percent = sentimentToPercent(value)
  const isStrong = Math.abs(value) >= 1.5

  return (
    <div className={`relative w-full h-2 rounded-full bg-[#1E293B] overflow-hidden ${isStrong ? 'h-2.5' : ''}`}>
      <div
        className="pulse-bar-fill absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${percent}%`,
          background: `linear-gradient(90deg, var(--aura-bear-strong) 0%, var(--aura-bear) 20%, #F59E0B 50%, var(--aura-bull) 80%, var(--aura-bull-strong) 100%)`,
          opacity: isTop ? 1 : 0.8,
        }}
      />
    </div>
  )
}

// ─── Market Pulse Section ───

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

// ─── Spotlight Cards ───

function SpotlightCards({ aggregated }: { aggregated: AggregatedTicker[] }) {
  if (aggregated.length < 2) return null

  // Base qualification: at least 3 mentions to avoid low-signal noise
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

  // 1. Top Bullish Pick
  const bestBull = [...qualified].filter(t => t.consensus_sentiment > 0.5).sort((a, b) => b.avg_conviction - a.avg_conviction)[0]
  if (bestBull) addCard('Highest Conviction', '◎', bestBull)

  // 2. Top Bearish Pick (If no highly discussed bear exists, fall back to ANY bear to ensure market diversity)
  let bestBear = [...qualified].filter(t => t.consensus_sentiment <= -0.5).sort((a, b) => a.consensus_sentiment - b.consensus_sentiment)[0]
  if (!bestBear) {
    bestBear = [...aggregated].filter(t => t.consensus_sentiment <= -0.5).sort((a, b) => a.consensus_sentiment - b.consensus_sentiment)[0]
  }
  if (bestBear) addCard('Most Bearish', '◌', bestBear)

  // 3. Fill the remaining slots up to 3 with Most Discussed
  const mostMentioned = [...qualified].sort((a, b) => b.mention_count - a.mention_count)
  for (const t of mostMentioned) {
    if (cards.length >= 3) break
    addCard(cards.length === 1 ? 'Viral Momentum' : 'Trending Now', '◉', t)
  }

  if (cards.length === 0) return null

  // Ensure grid fits beautifully and prevents massive stretching if there's only 1 or 2 cards
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
            {/* Soft Ambient Mesh Background */}
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
// ─── Trending Radars ───

function TrendingRadars({ radars }: { radars: RadarResponse[] }) {
  if (!radars || radars.length === 0) return null

  return (
    <div className="mb-8 animate-fade-up stagger-3">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-[#F59E0B]" />
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[#E2E8F0] font-[family-name:var(--font-geist-mono)]">
          Trending Radars
        </h2>
      </div>
      
      {/* Mobile: Horizontal scroll snap. Desktop: Grid */}
      <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 md:grid md:grid-cols-2 lg:grid-cols-3 hide-scrollbar">
        {radars.map(radar => (
          <RadarCard key={radar.slug} radar={radar} />
        ))}
      </div>
    </div>
  )
}




// ─── Sort & Filter Controls ───

interface RatingFilter {
  key: string
  label: string
  color: string
  activeColor: string
  activeBg: string
  activeBorder: string
}

const RATING_FILTERS: RatingFilter[] = [
  { key: '', label: 'All', color: 'text-[#8B95A8]', activeColor: 'text-[#F1F5F9]', activeBg: 'bg-[#1E293B]', activeBorder: 'border-[#2D3A4F]' },
  { key: 'strong-buy', label: 'Strong Buy', color: 'text-[#00FFD0]/60', activeColor: 'text-[#00FFD0]', activeBg: 'bg-[#00FFD0]/10', activeBorder: 'border-[#00FFD0]/30' },
  { key: 'buy', label: 'Buy', color: 'text-[#00D4AA]/60', activeColor: 'text-[#00D4AA]', activeBg: 'bg-[#00D4AA]/10', activeBorder: 'border-[#00D4AA]/30' },
  { key: 'neutral', label: 'Neutral', color: 'text-[#8B95A8]/60', activeColor: 'text-[#8B95A8]', activeBg: 'bg-[#8B95A8]/10', activeBorder: 'border-[#8B95A8]/30' },
  { key: 'sell', label: 'Sell', color: 'text-[#FF4D6A]/60', activeColor: 'text-[#FF4D6A]', activeBg: 'bg-[#FF4D6A]/10', activeBorder: 'border-[#FF4D6A]/30' },
  { key: 'strong-sell', label: 'Strong Sell', color: 'text-[#FF1744]/60', activeColor: 'text-[#FF1744]', activeBg: 'bg-[#FF1744]/10', activeBorder: 'border-[#FF1744]/30' },
]

function SortFilterBar({
  sort,
  setSort,
  filter,
  setFilter,
  counts,
  hasTargetOnly,
  setHasTargetOnly,
}: {
  sort: SortKey
  setSort: (s: SortKey) => void
  filter: string
  setFilter: (f: string) => void
  counts: Record<string, number>
  hasTargetOnly: boolean
  setHasTargetOnly: (v: boolean) => void
}) {
  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'mentions', label: 'Mentions' },
    { key: 'sentiment', label: 'Sentiment' },
    { key: 'conviction', label: 'Conviction' },
    { key: 'alpha', label: 'A→Z' },
  ]

  return (
    <div className="space-y-3">
      {/* Rating filter — the main visual element */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {RATING_FILTERS.map(rf => {
          const isActive = filter === rf.key
          const count = counts[rf.key] ?? 0
          return (
            <button
              key={rf.key}
              onClick={() => setFilter(filter === rf.key ? '' : rf.key)}
              className={`
                relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border
                ${isActive
                  ? `${rf.activeBg} ${rf.activeBorder} ${rf.activeColor}`
                  : `bg-transparent border-transparent ${rf.color} hover:border-[#1E293B] hover:bg-[#141B2D]/40`
                }
              `}
            >
              {rf.label}
              {rf.key !== '' && (
                <span className={`ml-1.5 font-[family-name:var(--font-geist-mono)] text-[10px] ${isActive ? 'opacity-80' : 'opacity-50'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Sort row + target toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.15em] text-[#475569]">Sort</span>
          <div className="flex gap-1">
            {sortOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => setSort(opt.key)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                  sort === opt.key
                    ? 'bg-[#00D4AA]/10 text-[#00D4AA] border border-[#00D4AA]/30'
                    : 'text-[#64748B] hover:text-[#8B95A8] border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Has Target toggle — independent, combinable */}
        <button
          onClick={() => setHasTargetOnly(!hasTargetOnly)}
          className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
            hasTargetOnly
              ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]'
              : 'bg-transparent border-[#1E293B] text-[#64748B] hover:text-[#8B95A8] hover:border-[#2D3A4F]'
          }`}
        >
          <span className="mr-1">$</span>Has Target
        </button>
      </div>
    </div>
  )
}

// ─── Ticker Row ───

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

function TickerRow({
  row,
  index,
  isTop,
}: {
  row: AggregatedTicker
  index: number
  isTop: boolean
}) {
  const staggerClass = `stagger-${Math.min(index + 1, 10)}`
  const isLowConfidence = row.mention_count < 3
  
  const direction = row.consensus_sentiment >= 0.5 ? 'BUY' : row.consensus_sentiment <= -0.5 ? 'SELL' : 'NEUTRAL'

  const borderGlowClass = direction === 'BUY' 
    ? 'border-l-[#00D4AA] group-hover:shadow-[-4px_0_15px_-3px_rgba(0,212,170,0.3)]' 
    : direction === 'SELL' 
      ? 'border-l-[#FF4D6A] group-hover:shadow-[-4px_0_15px_-3px_rgba(255,77,106,0.3)]'
      : 'border-l-[#8B95A8] group-hover:shadow-[-4px_0_15px_-3px_rgba(139,149,168,0.3)]'

  const textHoverClass = direction === 'BUY' ? 'group-hover:text-[#00D4AA]' : direction === 'SELL' ? 'group-hover:text-[#FF4D6A]' : 'group-hover:text-[#8B95A8]'

  return (
    <div className={`animate-fade-up ${staggerClass}`}>
      <Link
        href={`/ticker?s=${row.ticker}`}
        className={`
          group block relative w-full mb-3 rounded-r-xl rounded-l-sm bg-[#141B2D]/40 hover:bg-[#1E293B]/40 
          border border-transparent border-l-4 ${borderGlowClass}
          transition-all duration-300
          ${isLowConfidence ? 'opacity-70 hover:opacity-100' : ''}
          ${isTop ? 'bg-[#141B2D]/60' : ''}
        `}
      >
        {/* Inner subtle top/bottom border for definition */}
        <div className="absolute inset-0 rounded-r-xl border-y border-r border-[#1E293B]/50 pointer-events-none transition-colors group-hover:border-white/5" />
        
        <div className="p-4 md:p-5 w-full">
          {/* Desktop Layout - Dense Data Row */}
          <div className="hidden md:grid md:grid-cols-[1.5fr_2fr_1.5fr_1fr_auto] md:items-center md:gap-6 relative z-10">
            {/* 1. Ticker & Name */}
            <div className="flex items-baseline gap-3 overflow-hidden">
              <span className={`font-[family-name:var(--font-geist-mono)] text-xl font-bold tracking-wide text-[#F1F5F9] ${textHoverClass} transition-colors`}>
                {row.ticker}
              </span>
              <span className="text-xs text-[#64748B] truncate max-w-[140px]">{row.stock_name}</span>
            </div>

            {/* 2. Pulse Bar & Sentiment */}
            <div className="flex flex-col justify-center max-w-[200px] w-full">
              <div className="flex justify-between items-end mb-1">
                <span className={getSentimentBadgeClass(row.consensus_sentiment)}>
                  {getSentimentLabel(row.consensus_sentiment)}
                </span>
                <span className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[#64748B]">
                  {row.consensus_sentiment.toFixed(2)}
                </span>
              </div>
              <PulseBar value={row.consensus_sentiment} isTop={isTop} />
            </div>

            {/* 3. Mentions & Analysts (Density) */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#8B95A8] font-medium w-16">Mentions</span>
                <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[#F1F5F9]">{row.mention_count}</span>
                {isLowConfidence && (
                  <span className="ml-1 inline-flex items-center text-[9px] text-[#F59E0B]/70 bg-[#F59E0B]/5 px-1 py-0.5 rounded">low data</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#64748B] font-medium w-16">Analysts</span>
                <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[#8B95A8]">{row.analyst_count}</span>
              </div>
            </div>

            {/* 4. Conviction & Target */}
            <div className="flex flex-col justify-center gap-1.5 border-l border-[#1E293B]/60 pl-6 h-full">
              <ConvictionMini level={row.avg_conviction} />
              {row.avg_target_price !== null ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] text-[#64748B] uppercase tracking-wider">PT</span>
                  <span className="font-[family-name:var(--font-geist-mono)] text-sm font-semibold text-[#F1F5F9]">
                    ${row.avg_target_price.toFixed(0)}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-[#64748B]">No Target</span>
              )}
            </div>

            {/* 5. Chevron */}
            <div className={`text-[#64748B] ${textHoverClass} transition-colors justify-self-end`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="transform group-hover:translate-x-1 transition-transform">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </div>

          {/* Mobile layout */}
          <div className="md:hidden flex flex-col gap-3 relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <span className={`font-[family-name:var(--font-geist-mono)] text-2xl font-bold tracking-wide text-[#F1F5F9] ${textHoverClass} transition-colors`}>
                  {row.ticker}
                </span>
                {row.stock_name && (
                  <p className="text-xs text-[#64748B] mt-0.5 truncate max-w-[200px]">{row.stock_name}</p>
                )}
                {isLowConfidence && (
                  <span className="mt-1 inline-flex items-center text-[9px] text-[#F59E0B]/70 bg-[#F59E0B]/5 px-1 py-0.5 rounded">
                    low data
                  </span>
                )}
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                {row.avg_target_price !== null && (
                  <div className="font-[family-name:var(--font-geist-mono)] text-lg font-semibold text-[#F1F5F9]">
                    ${row.avg_target_price.toFixed(0)}
                  </div>
                )}
                <ConvictionMini level={row.avg_conviction} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 mt-2">
              <PulseBar value={row.consensus_sentiment} isTop={isTop} />
              <div className="flex items-center justify-between">
                <span className={getSentimentBadgeClass(row.consensus_sentiment)}>
                  {getSentimentLabel(row.consensus_sentiment)}
                </span>
                <div className="flex gap-3 text-[10px] text-[#64748B]">
                  <span>{row.mention_count} mentions</span>
                  <span>{row.analyst_count} analysts</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}

// ─── Main Page Component ───

export default function Home() {
  const [aggregated, setAggregated] = useState<AggregatedTicker[]>([])
  const [radars, setRadars] = useState<RadarResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('mentions')
  const [filter, setFilter] = useState('')
  const [hasTargetOnly, setHasTargetOnly] = useState(false)
  const [visibleCount, setVisibleCount] = useState(15)

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
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/v1/radars`)
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

  // Find top ticker
  const topTicker = aggregated.find(
    (t) => t.mention_count >= 3 && t.consensus_sentiment > 0
  )?.ticker

  // Bucket counts for the filter pills
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { '': aggregated.length, 'strong-buy': 0, buy: 0, neutral: 0, sell: 0, 'strong-sell': 0 }
    for (const t of aggregated) {
      if (t.consensus_sentiment >= 1.5) counts['strong-buy']++
      else if (t.consensus_sentiment >= 0.5) counts['buy']++
      else if (t.consensus_sentiment > -0.5) counts['neutral']++
      else if (t.consensus_sentiment > -1.5) counts['sell']++
      else counts['strong-sell']++
    }
    return counts
  }, [aggregated])

  // Sort + filter logic
  const processed = useMemo(() => {
    let list = [...aggregated]

    // Apply rating filter
    if (filter === 'strong-buy') {
      list = list.filter(t => t.consensus_sentiment >= 1.5)
    } else if (filter === 'buy') {
      list = list.filter(t => t.consensus_sentiment >= 0.5 && t.consensus_sentiment < 1.5)
    } else if (filter === 'neutral') {
      list = list.filter(t => t.consensus_sentiment > -0.5 && t.consensus_sentiment < 0.5)
    } else if (filter === 'sell') {
      list = list.filter(t => t.consensus_sentiment <= -0.5 && t.consensus_sentiment > -1.5)
    } else if (filter === 'strong-sell') {
      list = list.filter(t => t.consensus_sentiment <= -1.5)
    }

    // Apply "has target" toggle (independent of rating filter)
    if (hasTargetOnly) {
      list = list.filter(t => t.avg_target_price !== null)
    }

    // Apply search
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(t => t.ticker.toLowerCase().includes(q) || t.stock_name.toLowerCase().includes(q))
    }

    // Apply sort
    switch (sort) {
      case 'sentiment':
        list.sort((a, b) => b.consensus_sentiment - a.consensus_sentiment)
        break
      case 'conviction':
        list.sort((a, b) => b.avg_conviction - a.avg_conviction)
        break
      case 'alpha':
        list.sort((a, b) => a.ticker.localeCompare(b.ticker))
        break
      case 'mentions':
      default:
        list.sort((a, b) => b.mention_count - a.mention_count)
    }

    return list
  }, [aggregated, sort, filter, hasTargetOnly, search])

  // Reset visible count when filters change
  const visibleCountKey = `${search}|${sort}|${filter}|${hasTargetOnly}`
  useEffect(() => {
    setVisibleCount(15)
  }, [visibleCountKey])

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

  return (
    <div className="relative min-h-screen px-4 py-8 md:px-8 md:py-12 bg-[#0A0F1A] overflow-hidden">
      {/* Noise overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.015] mix-blend-overlay" 
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />
      
      <div className="relative z-10 w-full max-w-[1400px] mx-auto">
        {/* Hero Section */}
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

          <div className="text-center animate-hero-rise flex flex-col items-center gap-4 mt-2" style={{ animationDelay: '900ms' }}>
            <h2 className="text-2xl md:text-4xl font-medium tracking-tight text-[#E2E8F0]">
              Every stock analyst. One clear signal.
            </h2>
            <p className="text-lg md:text-xl text-[#8B95A8] font-light leading-relaxed max-w-2xl">
              Discover market-moving conviction by tracking real-time sentiment across top YouTube finance channels.
            </p>
          </div>

          {aggregated.length > 0 && (
            <div className="mt-10 md:mt-12 relative h-px animate-hero-rise" style={{ animationDelay: '1200ms' }}>
              <div className="absolute inset-0 bg-[#1E293B]" />
              <div className="absolute inset-0 h-px bg-gradient-to-r from-transparent via-[#00D4AA] to-transparent hero-pulse-line" />
            </div>
          )}
        </header>

        {/* Market Pulse */}
        {aggregated.length > 0 && (
          <div className="mb-6">
            <MarketPulse aggregated={aggregated} />
          </div>
        )}

        {/* Spotlight Cards */}
        {aggregated.length > 0 && (
          <div className="mb-6">
            <SpotlightCards aggregated={aggregated} />
          </div>
        )}

        {/* Trending Radars */}
        {radars.length > 0 && (
          <div className="mb-6">
            <TrendingRadars radars={radars} />
          </div>
        )}


        {/* Separator before ticker list */}
        {aggregated.length > 0 && (
          <div className="relative h-px mb-8 animate-fade-up stagger-3">
            <div className="absolute inset-0 bg-[#1E293B]" />
          </div>
        )}

        {/* Search + Sort/Filter */}
        {aggregated.length > 0 && (
          <div className="space-y-4 mb-6 animate-fade-up stagger-4">
            {/* Search input */}
            <div className="relative">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ticker or company..."
                className="w-full rounded-lg border border-[#1E293B] bg-[#141B2D]/60 pl-10 pr-4 py-2.5 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#00D4AA]/50 focus:ring-1 focus:ring-[#00D4AA]/20 transition-colors font-[family-name:var(--font-geist-mono)]"
                aria-label="Filter stocks by ticker symbol or company name"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#F1F5F9] transition-colors"
                  aria-label="Clear search"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Sort & Filter */}
            <SortFilterBar sort={sort} setSort={setSort} filter={filter} setFilter={setFilter} counts={filterCounts} hasTargetOnly={hasTargetOnly} setHasTargetOnly={setHasTargetOnly} />
          </div>
        )}

        {/* Ticker list */}
        {aggregated.length === 0 ? (
          <div className="rounded-xl border border-[#1E293B] bg-[#141B2D]/40 p-12 text-center animate-fade-up">
            <p className="text-lg text-[#8B95A8]">No signals yet.</p>
            <p className="mt-2 text-sm text-[#64748B]">
              Recommendations will appear here once videos are ingested.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {processed.length === 0 ? (
              <div className="rounded-xl border border-[#1E293B] bg-[#141B2D]/40 p-8 text-center">
                <p className="text-sm text-[#8B95A8]">
                  No tickers matching your filters
                </p>
              </div>
            ) : (
              <>
                {processed.slice(0, visibleCount).map((row, index) => (
                  <TickerRow
                    key={row.ticker}
                    row={row}
                    index={index}
                    isTop={row.ticker === topTicker}
                  />
                ))}
                {visibleCount < processed.length && (
                  <div className="pt-4 text-center">
                    <button
                      onClick={() => setVisibleCount((c) => c + 15)}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[#1E293B] bg-[#141B2D]/60 text-sm font-medium text-[#8B95A8] hover:text-[#00D4AA] hover:border-[#00D4AA]/30 hover:bg-[#141B2D] transition-all duration-200"
                    >
                      <span>Load more</span>
                      <span className="font-[family-name:var(--font-geist-mono)] text-[11px] text-[#475569]">
                        {processed.length - visibleCount} remaining
                      </span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Footer disclaimer */}
        {aggregated.length > 0 && (
          <footer className="mt-12 pt-6 border-t border-[#1E293B] animate-fade-up stagger-10">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-[#64748B] leading-relaxed">
                Trust-weighted consensus · <span className="text-[#8B95A8]">*</span> fewer than 3 mentions
              </p>
              <p className="font-[family-name:var(--font-geist-mono)] text-[11px] text-[#475569] tracking-wide">
                <span className="text-[#64748B]">{aggregated.length}</span> tickers · <span className="text-[#64748B]">{aggregated.reduce((s, t) => s + t.mention_count, 0)}</span> mentions
              </p>
            </div>
          </footer>
        )}
      </div>
    </div>
  )
}
