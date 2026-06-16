'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface RecommendationRow {
  ticker: string
  sentiment: number
  target_price: number | null
  videos: {
    channel_id: string
    channels: {
      trust_weight: number
    }
  }
}

interface AggregatedTicker {
  ticker: string
  consensus_sentiment: number
  avg_target_price: number | null
  mention_count: number
}

function aggregateRecommendations(
  recommendations: RecommendationRow[]
): AggregatedTicker[] {
  const grouped = new Map<
    string,
    { sentiments: { value: number; weight: number }[]; prices: number[]; count: number }
  >()

  for (const rec of recommendations) {
    const ticker = rec.ticker
    if (!grouped.has(ticker)) {
      grouped.set(ticker, { sentiments: [], prices: [], count: 0 })
    }
    const group = grouped.get(ticker)!
    const trustWeight = rec.videos.channels.trust_weight
    group.sentiments.push({ value: rec.sentiment, weight: trustWeight })
    if (rec.target_price !== null) {
      group.prices.push(rec.target_price)
    }
    group.count++
  }

  const results: AggregatedTicker[] = []

  for (const [ticker, group] of grouped) {
    const weightedSum = group.sentiments.reduce(
      (sum, s) => sum + s.value * s.weight,
      0
    )
    const totalWeight = group.sentiments.reduce(
      (sum, s) => sum + s.weight,
      0
    )
    const rawSentiment = totalWeight > 0 ? weightedSum / totalWeight : 0

    const confidence = Math.min(group.count / 3, 1)
    const consensus_sentiment =
      Math.round(rawSentiment * confidence * 100) / 100

    const avg_target_price =
      group.prices.length > 0
        ? group.prices.reduce((sum, p) => sum + p, 0) / group.prices.length
        : null

    results.push({
      ticker,
      consensus_sentiment,
      avg_target_price,
      mention_count: group.count,
    })
  }

  results.sort((a, b) => b.mention_count - a.mention_count)
  return results
}

function getSentimentLabel(value: number): string {
  if (value >= 1.5) return "Strong Buy"
  if (value >= 0.5) return "Buy"
  if (value > -0.5) return "Neutral"
  if (value > -1.5) return "Sell"
  return "Strong Sell"
}

/** Convert sentiment from [-2, 2] to a percentage [0, 100] for the pulse bar */
function sentimentToPercent(value: number): number {
  return ((value + 2) / 4) * 100
}

function PulseBar({ value, isTop }: { value: number; isTop: boolean }) {
  const percent = sentimentToPercent(value)

  // Gradient goes from bear (red) on the left to bull (teal) on the right
  // The "fill" represents where the sentiment sits
  return (
    <div className="relative w-full h-2 rounded-full bg-[#1E293B] overflow-hidden">
      <div
        className="pulse-bar-fill absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${percent}%`,
          background: `linear-gradient(90deg, var(--aura-bear) 0%, #F59E0B 50%, var(--aura-bull) 100%)`,
          opacity: isTop ? 1 : 0.8,
        }}
      />
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

  return (
    <Link
      href={`/ticker?s=${row.ticker}`}
      className={`
        group block rounded-xl border p-5 md:p-6 transition-all duration-200
        ${isTop
          ? 'border-[#00D4AA]/30 bg-[#141B2D] animate-glow'
          : 'border-[#1E293B] bg-[#141B2D]/60 hover:border-[#2D3A4F] hover:bg-[#141B2D]'
        }
        animate-fade-up ${staggerClass}
      `}
    >
      {/* Desktop layout */}
      <div className="hidden md:grid md:grid-cols-[1fr_2fr_auto_auto] md:items-center md:gap-6">
        {/* Ticker + label */}
        <div className="flex items-baseline gap-3">
          <span className="font-[family-name:var(--font-geist-mono)] text-2xl font-bold tracking-wide text-[#F1F5F9] group-hover:text-[#00D4AA] transition-colors">
            {row.ticker}
          </span>
          <span className="text-xs text-[#8B95A8] font-medium">
            {row.mention_count} mention{row.mention_count !== 1 ? 's' : ''}
            {row.mention_count < 3 && ' *'}
          </span>
        </div>

        {/* Pulse bar + sentiment label */}
        <div className="flex flex-col gap-1.5">
          <PulseBar value={row.consensus_sentiment} isTop={isTop} />
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${
              row.consensus_sentiment >= 0.5 ? 'text-[#00D4AA]' :
              row.consensus_sentiment <= -0.5 ? 'text-[#FF4D6A]' :
              'text-[#8B95A8]'
            }`}>
              {getSentimentLabel(row.consensus_sentiment)}
            </span>
            <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[#64748B]">
              {row.consensus_sentiment.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Target price */}
        <div className="text-right">
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
          <span className="font-[family-name:var(--font-geist-mono)] text-3xl font-bold tracking-wide text-[#F1F5F9]">
            {row.ticker}
          </span>
          {row.avg_target_price !== null && (
            <span className="font-[family-name:var(--font-geist-mono)] text-xl font-semibold text-[#F1F5F9]">
              ${row.avg_target_price.toFixed(0)}
            </span>
          )}
        </div>

        <PulseBar value={row.consensus_sentiment} isTop={isTop} />

        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium ${
            row.consensus_sentiment >= 0.5 ? 'text-[#00D4AA]' :
            row.consensus_sentiment <= -0.5 ? 'text-[#FF4D6A]' :
            'text-[#8B95A8]'
          }`}>
            {getSentimentLabel(row.consensus_sentiment)}
            <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[#64748B] ml-2">
              {row.consensus_sentiment.toFixed(2)}
            </span>
          </span>
          <span className="text-xs text-[#8B95A8]">
            {row.mention_count} mention{row.mention_count !== 1 ? 's' : ''}
            {row.mention_count < 3 && ' *'}
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function Home() {
  const [aggregated, setAggregated] = useState<AggregatedTicker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const { data: recommendations } = await supabase
        .from("recommendations")
        .select(`
          ticker,
          sentiment,
          target_price,
          videos!inner(
            channel_id,
            channels!inner(trust_weight)
          )
        `)

      const agg = recommendations
        ? aggregateRecommendations(recommendations as unknown as RecommendationRow[])
        : []
      setAggregated(agg)
      setLoading(false)
    }
    fetchData()
  }, [])

  // Find top ticker (highest sentiment with 3+ mentions)
  const topTicker = aggregated.find(
    (t) => t.mention_count >= 3 && t.consensus_sentiment > 0
  )?.ticker

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          {/* The aura glow */}
          <div
            className="absolute glow-emerge"
            style={{ width: '320px', height: '320px', animationDelay: '600ms' }}
          >
            <div className="aura-glow" />
            <div className="aura-glow-inner" />
          </div>
          <div className="relative text-center">
            <div className="text-8xl md:text-9xl font-extralight tracking-[0.25em] logo-sweep">
              {'Aura'.split('').map((letter, i) => (
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
        <header className="mb-16 md:mb-24 pt-8 md:pt-16">
          {/* AURA logo with radiating glow + letter animation — centered */}
          <div className="relative flex flex-col items-center mb-8 md:mb-10">
            {/* Glow layers — emerge after letters form */}
            <div
              className="absolute w-[320px] h-[240px] md:w-[500px] md:h-[320px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 glow-emerge"
              style={{ animationDelay: '600ms' }}
            >
              <div className="aura-glow" />
              <div className="aura-glow-inner" />
            </div>

            {/* The wordmark — each letter materializes from blur */}
            <h1 className="relative text-8xl md:text-9xl lg:text-[11rem] font-extralight tracking-[0.2em] md:tracking-[0.25em] logo-sweep leading-none">
              {'Aura'.split('').map((letter, i) => (
                <span
                  key={i}
                  className="logo-letter letter-materialize"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  {letter}
                </span>
              ))}
            </h1>

            {/* by noor — fades in after the logo forms */}
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

          {/* Subtitle — centered */}
          <div className="text-center animate-hero-rise" style={{ animationDelay: '900ms' }}>
            <p className="text-xl md:text-2xl text-[#8B95A8] font-light leading-relaxed">
              Every analyst. One signal.
            </p>
          </div>

          {/* Live stats — centered */}
          {aggregated.length > 0 && (
            <div className="mt-4 text-center animate-hero-rise" style={{ animationDelay: '1050ms' }}>
              <p className="font-[family-name:var(--font-geist-mono)] text-xs text-[#64748B] tracking-wide">
                <span className="text-[#8B95A8]">{aggregated.length}</span> tickers
                <span className="mx-2 text-[#1E293B]">·</span>
                <span className="text-[#8B95A8]">{totalMentions}</span> mentions
              </p>
            </div>
          )}

          {/* Pulse line separator */}
          <div className="mt-10 md:mt-12 relative h-px animate-hero-rise" style={{ animationDelay: '1200ms' }}>
            <div className="absolute inset-0 bg-[#1E293B]" />
            <div className="absolute inset-0 h-px bg-gradient-to-r from-transparent via-[#00D4AA] to-transparent hero-pulse-line" />
          </div>
        </header>

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
            {aggregated.map((row, index) => (
              <TickerRow
                key={row.ticker}
                row={row}
                index={index}
                isTop={row.ticker === topTicker}
              />
            ))}
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
