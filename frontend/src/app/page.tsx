'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ─── Types ───

interface RecommendationRow {
  ticker: string
  stock_name: string
  sentiment: number
  target_price: number | null
  conviction_level: number
  videos: {
    channel_id: string
    channels: {
      trust_weight: number
    }
  }
}

interface RecentSignal {
  ticker: string
  stock_name: string
  sentiment: number
  conviction_level: number
  target_price: number | null
  catalyst_notes: string
  videos: {
    youtube_video_id: string
    published_at: string
    extracted_at: string
    channels: {
      channel_name: string
    }
  }
}

interface AggregatedTicker {
  ticker: string
  stock_name: string
  consensus_sentiment: number
  avg_target_price: number | null
  avg_conviction: number
  mention_count: number
  analyst_count: number
}

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

  // Weighted average across all tickers (by mention count)
  const overallSentiment = totalMentions > 0
    ? aggregated.reduce((s, t) => s + t.consensus_sentiment * t.mention_count, 0) / totalMentions
    : 0

  const lean = getMarketLeanLabel(overallSentiment)

  // Distribution buckets
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
    <div className="rounded-2xl border border-[#1E293B] bg-[#141B2D]/60 p-6 md:p-8 animate-fade-up stagger-1">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-[#00D4AA] animate-pulse" />
        <span className="text-[10px] uppercase tracking-[0.2em] text-[#64748B] font-medium">Market Pulse</span>
        <button
          type="button"
          className="group relative ml-auto cursor-help focus:outline-none"
          aria-label="Market pulse info"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#475569] hover:text-[#64748B] transition-colors">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span className="absolute bottom-full right-0 mb-2 w-64 p-3 rounded-lg bg-[#1E293B] border border-[#2D3A4F] text-[11px] text-[#8B95A8] leading-relaxed opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
            Weighted average of all ticker consensus scores, weighted by mention count. Each ticker&apos;s consensus is trust-weighted and dampened until 3+ mentions.
          </span>
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        {/* Overall lean */}
        <div>
          <p className={`text-4xl md:text-5xl font-bold tracking-tight ${lean.color}`}>
            {lean.label}
          </p>
          <p className="mt-1 font-[family-name:var(--font-geist-mono)] text-sm text-[#64748B]">
            Overall sentiment: {overallSentiment.toFixed(2)}
          </p>
        </div>

        {/* Distribution bar */}
        <div className="flex-1 max-w-xs">
          <div className="flex w-full h-3 rounded-full overflow-hidden bg-[#1E293B]">
            {buckets.strongBuy > 0 && <div className="h-full bg-[#00FFD0]" style={{ width: `${(buckets.strongBuy / total) * 100}%` }} />}
            {buckets.buy > 0 && <div className="h-full bg-[#00D4AA]" style={{ width: `${(buckets.buy / total) * 100}%` }} />}
            {buckets.neutral > 0 && <div className="h-full bg-[#475569]" style={{ width: `${(buckets.neutral / total) * 100}%` }} />}
            {buckets.sell > 0 && <div className="h-full bg-[#FF4D6A]" style={{ width: `${(buckets.sell / total) * 100}%` }} />}
            {buckets.strongSell > 0 && <div className="h-full bg-[#FF1744]" style={{ width: `${(buckets.strongSell / total) * 100}%` }} />}
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] font-[family-name:var(--font-geist-mono)] text-[#64748B]">
            <span>{buckets.strongBuy + buckets.buy} bullish</span>
            <span>{buckets.neutral} neutral</span>
            <span>{buckets.sell + buckets.strongSell} bearish</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Spotlight Cards ───

function SpotlightCards({ aggregated }: { aggregated: AggregatedTicker[] }) {
  if (aggregated.length < 2) return null

  // Only consider tickers with 2+ mentions for spotlights
  const qualified = aggregated.filter(t => t.mention_count >= 2)
  if (qualified.length === 0) return null

  const highestConviction = [...qualified].sort((a, b) => b.avg_conviction - a.avg_conviction)[0]
  const mostMentioned = qualified[0] // already sorted by mentions
  const mostBearish = [...qualified].sort((a, b) => a.consensus_sentiment - b.consensus_sentiment)[0]

  // Avoid duplicates
  const cards: { label: string; icon: string; ticker: AggregatedTicker; accent: string }[] = []
  const seen = new Set<string>()

  if (highestConviction && !seen.has(highestConviction.ticker)) {
    cards.push({ label: 'Highest Conviction', icon: '◎', ticker: highestConviction, accent: 'border-[#00D4AA]/20' })
    seen.add(highestConviction.ticker)
  }
  if (mostMentioned && !seen.has(mostMentioned.ticker)) {
    cards.push({ label: 'Most Discussed', icon: '◉', ticker: mostMentioned, accent: 'border-[#8B95A8]/20' })
    seen.add(mostMentioned.ticker)
  }
  if (mostBearish && mostBearish.consensus_sentiment < 0 && !seen.has(mostBearish.ticker)) {
    cards.push({ label: 'Most Bearish', icon: '◌', ticker: mostBearish, accent: 'border-[#FF4D6A]/20' })
    seen.add(mostBearish.ticker)
  }

  if (cards.length === 0) return null

  return (
    <div className={`grid gap-3 ${cards.length === 3 ? 'md:grid-cols-3' : cards.length === 2 ? 'md:grid-cols-2' : ''} animate-fade-up stagger-2`}>
      {cards.map(({ label, icon, ticker, accent }) => (
        <Link
          key={ticker.ticker}
          href={`/ticker?s=${ticker.ticker}`}
          className={`group rounded-xl border ${accent} bg-[#141B2D]/40 p-5 hover:bg-[#141B2D] hover:border-[#2D3A4F] transition-all duration-200`}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm text-[#475569]">{icon}</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-[#64748B]">{label}</span>
          </div>
          <p className="font-[family-name:var(--font-geist-mono)] text-2xl font-bold text-[#F1F5F9] group-hover:text-[#00D4AA] transition-colors tracking-wide">
            {ticker.ticker}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className={getSentimentBadgeClass(ticker.consensus_sentiment)}>
              {getSentimentLabel(ticker.consensus_sentiment)}
            </span>
            <span className="font-[family-name:var(--font-geist-mono)] text-[11px] text-[#64748B]">
              {ticker.mention_count} mentions
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}

// ─── Recent Signals Feed ───

function RecentSignalsFeed({ signals }: { signals: RecentSignal[] }) {
  if (signals.length === 0) return null

  return (
    <div className="rounded-2xl border border-[#1E293B] bg-[#141B2D]/40 p-6 animate-fade-up stagger-3">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#475569]">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#64748B] font-medium">Latest Signals</span>
        </div>
        <span className="text-[10px] text-[#475569]">
          Last ingested {timeAgo(signals[0].videos.extracted_at)}
        </span>
      </div>

      <div className="space-y-3">
        {signals.map((signal, i) => (
          <Link
            key={`${signal.ticker}-${i}`}
            href={`/ticker?s=${signal.ticker}`}
            className="group flex items-center gap-4 py-2 px-3 -mx-3 rounded-lg hover:bg-[#0A0F1A]/60 transition-colors"
          >
            <span className="font-[family-name:var(--font-geist-mono)] text-lg font-bold text-[#F1F5F9] group-hover:text-[#00D4AA] transition-colors w-16 shrink-0">
              {signal.ticker}
            </span>
            <span className={getSentimentBadgeClass(signal.sentiment)}>
              {getSentimentLabel(signal.sentiment)}
            </span>
            <span className="hidden sm:inline text-xs text-[#64748B] truncate flex-1">
              {signal.videos.channels.channel_name}
            </span>
            <span className="font-[family-name:var(--font-geist-mono)] text-[11px] text-[#475569] shrink-0">
              {timeAgo(signal.videos.extracted_at)}
            </span>
          </Link>
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

  return (
    <Link
      href={`/ticker?s=${row.ticker}`}
      className={`
        group block rounded-xl border p-5 md:p-6 transition-all duration-200
        ${isTop
          ? 'border-[#00D4AA]/30 bg-[#141B2D] animate-glow'
          : isLowConfidence
            ? 'border-[#1E293B]/60 bg-[#141B2D]/30 hover:border-[#2D3A4F] hover:bg-[#141B2D]'
            : 'border-[#1E293B] bg-[#141B2D]/60 hover:border-[#2D3A4F] hover:bg-[#141B2D]'
        }
        animate-fade-up ${staggerClass}
      `}
    >
      {/* Desktop layout */}
      <div className="hidden md:grid md:grid-cols-[1.2fr_2fr_auto_auto_auto] md:items-center md:gap-5">
        {/* Ticker + meta */}
        <div>
          <span className="font-[family-name:var(--font-geist-mono)] text-2xl font-bold tracking-wide text-[#F1F5F9] group-hover:text-[#00D4AA] transition-colors">
            {row.ticker}
          </span>
          {row.stock_name && (
            <p className="text-xs text-[#64748B] mt-0.5">{row.stock_name}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-[#64748B]">
              {row.mention_count} mention{row.mention_count !== 1 ? 's' : ''}
            </span>
            <span className="text-[#1E293B]" aria-hidden="true">·</span>
            <span className="text-[11px] text-[#64748B]">
              {row.analyst_count} analyst{row.analyst_count !== 1 ? 's' : ''}
            </span>
            {isLowConfidence && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-[#F59E0B]/70 bg-[#F59E0B]/5 border border-[#F59E0B]/10 rounded px-1.5 py-0.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="shrink-0">
                  <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                low data
              </span>
            )}
          </div>
        </div>

        {/* Pulse bar + sentiment */}
        <div className="flex flex-col gap-1.5">
          <PulseBar value={row.consensus_sentiment} isTop={isTop} />
          <div className="flex items-center justify-between">
            <span className={getSentimentBadgeClass(row.consensus_sentiment)}>
              <SentimentArrow value={row.consensus_sentiment} />
              {getSentimentLabel(row.consensus_sentiment)}
            </span>
            <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[#64748B]">
              {row.consensus_sentiment.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Conviction */}
        <ConvictionMini level={row.avg_conviction} />

        {/* Target price */}
        <div className="text-right min-w-[4rem]">
          {row.avg_target_price !== null ? (
            <span className="font-[family-name:var(--font-geist-mono)] text-lg font-semibold text-[#F1F5F9]">
              ${row.avg_target_price.toFixed(0)}
            </span>
          ) : (
            <span className="text-sm text-[#64748B]">—</span>
          )}
        </div>

        {/* Arrow */}
        <div className="text-[#64748B] group-hover:text-[#00D4AA] transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transform group-hover:translate-x-0.5 transition-transform">
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-[family-name:var(--font-geist-mono)] text-3xl font-bold tracking-wide text-[#F1F5F9]">
              {row.ticker}
            </span>
            {row.stock_name && (
              <p className="text-xs text-[#64748B] mt-0.5">{row.stock_name}</p>
            )}
            {isLowConfidence && (
              <span className="ml-2 inline-flex items-center gap-0.5 text-[9px] text-[#F59E0B]/70 bg-[#F59E0B]/5 border border-[#F59E0B]/10 rounded px-1 py-0.5 align-middle">
                low data
              </span>
            )}
          </div>
          {row.avg_target_price !== null && (
            <span className="font-[family-name:var(--font-geist-mono)] text-xl font-semibold text-[#F1F5F9]">
              ${row.avg_target_price.toFixed(0)}
            </span>
          )}
        </div>

        <PulseBar value={row.consensus_sentiment} isTop={isTop} />

        <div className="flex items-center justify-between">
          <span className={getSentimentBadgeClass(row.consensus_sentiment)}>
            <SentimentArrow value={row.consensus_sentiment} />
            {getSentimentLabel(row.consensus_sentiment)}
            <span className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[#64748B] ml-1">
              {row.consensus_sentiment.toFixed(2)}
            </span>
          </span>
          <div className="flex items-center gap-3">
            <ConvictionMini level={row.avg_conviction} />
            <span className="text-[11px] text-[#64748B]">
              {row.analyst_count} analyst{row.analyst_count !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Main Page Component ───

export default function Home() {
  const [aggregated, setAggregated] = useState<AggregatedTicker[]>([])
  const [recentSignals, setRecentSignals] = useState<RecentSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('mentions')
  const [filter, setFilter] = useState('')
  const [hasTargetOnly, setHasTargetOnly] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()

      const [recsRes, recentRes] = await Promise.all([
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
        supabase
          .from("recommendations")
          .select(`
            ticker,
            stock_name,
            sentiment,
            conviction_level,
            target_price,
            catalyst_notes,
            videos!inner(
              youtube_video_id,
              published_at,
              extracted_at,
              channels!inner(channel_name)
            )
          `)
          .order('videos(extracted_at)', { ascending: false })
          .limit(5),
      ])

      const agg = recsRes.data
        ? aggregateRecommendations(recsRes.data as unknown as RecommendationRow[])
        : []
      setAggregated(agg)
      setRecentSignals((recentRes.data as unknown as RecentSignal[]) || [])
      setLoading(false)
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

  const totalMentions = aggregated.reduce((sum, t) => sum + t.mention_count, 0)

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 md:py-12">
      <div className="max-w-4xl mx-auto">
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

          <div className="text-center animate-hero-rise" style={{ animationDelay: '900ms' }}>
            <p className="text-xl md:text-2xl text-[#8B95A8] font-light leading-relaxed">
              Every analyst. One signal.
            </p>
          </div>

          {aggregated.length > 0 && (
            <div className="mt-4 text-center animate-hero-rise" style={{ animationDelay: '1050ms' }}>
              <p className="font-[family-name:var(--font-geist-mono)] text-xs text-[#64748B] tracking-wide">
                <span className="text-[#8B95A8]">{aggregated.length}</span> tickers
                <span className="mx-2 text-[#1E293B]">·</span>
                <span className="text-[#8B95A8]">{totalMentions}</span> mentions
                <span className="mx-2 text-[#1E293B]">·</span>
                <Link href="/channels" className="text-[#8B95A8] hover:text-[#00D4AA] transition-colors duration-200">
                  analysts ↗
                </Link>
              </p>
            </div>
          )}

          <div className="mt-10 md:mt-12 relative h-px animate-hero-rise" style={{ animationDelay: '1200ms' }}>
            <div className="absolute inset-0 bg-[#1E293B]" />
            <div className="absolute inset-0 h-px bg-gradient-to-r from-transparent via-[#00D4AA] to-transparent hero-pulse-line" />
          </div>
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

        {/* Recent Signals */}
        {recentSignals.length > 0 && (
          <div className="mb-10">
            <RecentSignalsFeed signals={recentSignals} />
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
              processed.map((row, index) => (
                <TickerRow
                  key={row.ticker}
                  row={row}
                  index={index}
                  isTop={row.ticker === topTicker}
                />
              ))
            )}
          </div>
        )}

        {/* Footer disclaimer */}
        {aggregated.length > 0 && (
          <footer className="mt-12 pt-6 border-t border-[#1E293B] animate-fade-up stagger-10">
            <p className="text-xs text-[#64748B] leading-relaxed">
              Sentiment weighted by channel trust · Dampened until 3+ mentions · Updated on ingest ·{' '}
              <span className="text-[#8B95A8]">*</span> Low confidence (fewer than 3 mentions)
            </p>
          </footer>
        )}
      </div>
    </div>
  )
}
