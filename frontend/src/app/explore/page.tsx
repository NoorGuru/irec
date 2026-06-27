'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Activity } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { RecommendationRow, AggregatedTicker } from '@/lib/types'
import { TickerRow } from '@/components/TickerRow'

type SortKey = 'mentions' | 'sentiment' | 'conviction' | 'alpha'

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
  highDataOnly,
  setHighDataOnly,
}: {
  sort: SortKey
  setSort: (s: SortKey) => void
  filter: string
  setFilter: (f: string) => void
  counts: Record<string, number>
  hasTargetOnly: boolean
  setHasTargetOnly: (v: boolean) => void
  highDataOnly: boolean
  setHighDataOnly: (v: boolean) => void
}) {
  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'mentions', label: 'Mentions' },
    { key: 'sentiment', label: 'Sentiment' },
    { key: 'conviction', label: 'Conviction' },
    { key: 'alpha', label: 'A→Z' },
  ]

  return (
    <div className="space-y-3">
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

        <button
          onClick={() => setHasTargetOnly(!hasTargetOnly)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
            hasTargetOnly
              ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]'
              : 'bg-transparent border-[#1E293B] text-[#64748B] hover:text-[#8B95A8] hover:border-[#2D3A4F]'
          }`}
        >
          <span className="mr-1">$</span>Has Target
        </button>

        <button
          onClick={() => setHighDataOnly(!highDataOnly)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
            highDataOnly
              ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]'
              : 'bg-transparent border-[#1E293B] text-[#64748B] hover:text-[#8B95A8] hover:border-[#2D3A4F]'
          }`}
        >
          <span className="mr-1">📊</span>High Data Only
        </button>
      </div>
    </div>
  )
}

export default function Explore() {
  const [aggregated, setAggregated] = useState<AggregatedTicker[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('mentions')
  const [filter, setFilter] = useState('')
  const [hasTargetOnly, setHasTargetOnly] = useState(false)
  const [highDataOnly, setHighDataOnly] = useState(false)
  const [visibleCount, setVisibleCount] = useState(15)

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient()
        const recsRes = await supabase
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
            `)

        const agg = recsRes.data
          ? aggregateRecommendations(recsRes.data as unknown as RecommendationRow[])
          : []
        setAggregated(agg)
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const topTicker = aggregated.find(
    (t) => t.mention_count >= 3 && t.consensus_sentiment > 0
  )?.ticker

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

  const processed = useMemo(() => {
    let list = [...aggregated]
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
    if (hasTargetOnly) {
      list = list.filter(t => t.avg_target_price !== null)
    }
    if (highDataOnly) {
      list = list.filter(t => t.mention_count >= 3)
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(t => t.ticker.toLowerCase().includes(q) || t.stock_name.toLowerCase().includes(q))
    }
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
  }, [aggregated, sort, filter, hasTargetOnly, search, highDataOnly])

  useEffect(() => {
    setVisibleCount(15)
  }, [search, sort, filter, hasTargetOnly, highDataOnly])

  if (loading) {
    return <Loading title="Explore" />
  }

  return (
    <div className="relative min-h-screen px-4 py-8 md:px-8 md:py-12 bg-[#0A0F1A] overflow-hidden">
      <div 
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.015] mix-blend-overlay" 
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />
      
      <div className="relative z-10 w-full max-w-[1400px] mx-auto pt-8">
        <header className="mb-8 md:mb-12">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
            <h1 className="text-4xl md:text-5xl font-extralight tracking-wide text-[#F1F5F9]">
              Market Explorer
            </h1>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141B2D]/60 border border-[#1E293B]">
              <span className="text-xs text-[#64748B] uppercase tracking-wider">Total Tickers</span>
              <span className="font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[#00D4AA]">
                {aggregated.length}
              </span>
            </div>
          </div>
          <p className="text-[#8B95A8] max-w-2xl text-lg font-light leading-relaxed">
            Scan the entire market across all extracted signals. Use filters to zero in on high conviction setups.
          </p>
        </header>

        {aggregated.length > 0 && (
          <div className="space-y-4 mb-6 animate-fade-up stagger-1">
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

            <SortFilterBar
              sort={sort}
              setSort={setSort}
              filter={filter}
              setFilter={setFilter}
              counts={filterCounts}
              hasTargetOnly={hasTargetOnly}
              setHasTargetOnly={setHasTargetOnly}
              highDataOnly={highDataOnly}
              setHighDataOnly={setHighDataOnly}
            />
          </div>
        )}

        {aggregated.length === 0 ? (
          <div className="rounded-xl border border-[#1E293B] bg-[#141B2D]/40 p-12 text-center animate-fade-up">
            <p className="text-lg text-[#8B95A8]">No signals yet.</p>
            <p className="mt-2 text-sm text-[#64748B]">
              Recommendations will appear here once videos are ingested.
            </p>
          </div>
        ) : (
          <div className="space-y-3 animate-fade-up stagger-2">
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

      </div>
    </div>
  )
}
