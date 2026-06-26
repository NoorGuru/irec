'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Activity } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { RadarConfig } from '@/lib/radars'
import { AggregatedTicker, RecommendationRow } from '@/lib/types'

// Reusing aggregations
function aggregateRecommendations(recommendations: RecommendationRow[]): AggregatedTicker[] {
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
    if (rec.target_price !== null) group.prices.push(rec.target_price)
    group.convictions.push(rec.conviction_level)
    group.channels.add(rec.videos.channel_id)
    group.count++
    if (rec.stock_name && !group.stock_name) group.stock_name = rec.stock_name
  }

  const results: AggregatedTicker[] = []
  for (const [ticker, group] of grouped) {
    const weightedSum = group.sentiments.reduce((sum, s) => sum + s.value * s.weight, 0)
    const totalWeight = group.sentiments.reduce((sum, s) => sum + s.weight, 0)
    const rawSentiment = totalWeight > 0 ? weightedSum / totalWeight : 0
    const confidence = Math.min(group.count / 3, 1)
    const consensus_sentiment = Math.round(rawSentiment * confidence * 100) / 100
    const avg_target_price = group.prices.length > 0 ? group.prices.reduce((sum, p) => sum + p, 0) / group.prices.length : null
    const avg_conviction = group.convictions.reduce((s, c) => s + c, 0) / group.convictions.length
    results.push({ ticker, stock_name: group.stock_name, consensus_sentiment, avg_target_price, avg_conviction, mention_count: group.count, analyst_count: group.channels.size })
  }
  return results.sort((a, b) => b.mention_count - a.mention_count)
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

function sentimentToPercent(value: number): number {
  return ((value + 2) / 4) * 100
}

function PulseBar({ value }: { value: number }) {
  const percent = sentimentToPercent(value)
  return (
    <div className="relative w-full h-1.5 rounded-full bg-[#1E293B] overflow-hidden">
      <div
        className="pulse-bar-fill absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${percent}%`,
          background: `linear-gradient(90deg, var(--aura-bear-strong) 0%, var(--aura-bear) 20%, #F59E0B 50%, var(--aura-bull) 80%, var(--aura-bull-strong) 100%)`,
        }}
      />
    </div>
  )
}

export default function RadarDetailClient({ radar }: { radar: RadarConfig }) {
  const [aggregated, setAggregated] = useState<AggregatedTicker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const { data } = await supabase
        .from('recommendations')
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
      
      let agg = data ? aggregateRecommendations(data as unknown as RecommendationRow[]) : []
      
      // Filter only for the radar constituents
      agg = agg.filter(t => radar.tickers.includes(t.ticker))
      
      // Ensure all tickers are represented, even if no mentions
      const withBlanks = radar.tickers.map(tickerSymbol => {
        const found = agg.find(t => t.ticker === tickerSymbol)
        return found || {
          ticker: tickerSymbol,
          stock_name: '',
          consensus_sentiment: 0,
          avg_target_price: null,
          avg_conviction: 0,
          mention_count: 0,
          analyst_count: 0
        }
      })

      // Sort by mentions
      withBlanks.sort((a, b) => b.mention_count - a.mention_count)

      setAggregated(withBlanks)
      setLoading(false)
    }
    fetchData()
  }, [radar])

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <Activity className="w-8 h-8 text-[#00D4AA] animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <h3 className="text-xl font-medium tracking-tight text-[#E2E8F0]">
          Constituents
        </h3>
        <span className="text-[#64748B] bg-[#1E293B]/50 px-2 py-0.5 rounded-full text-xs font-[family-name:var(--font-geist-mono)]">
          {aggregated.length}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {aggregated.map((row, index) => {
          const isBlank = row.mention_count === 0
          
          return (
            <Link
              key={row.ticker}
              href={`/ticker?s=${row.ticker}`}
              className={`group flex flex-col p-5 rounded-2xl bg-[#141B2D]/40 backdrop-blur-md border border-white/5 transition-all duration-300 ${
                !isBlank ? 'hover:-translate-y-1 hover:border-white/10 hover:bg-[#1E293B]/40' : 'opacity-60 grayscale hover:grayscale-0'
              } animate-fade-up`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className={`text-2xl font-bold tracking-wide font-[family-name:var(--font-geist-mono)] ${!isBlank ? 'text-[#F1F5F9]' : 'text-[#8B95A8]'}`}>
                    {row.ticker}
                  </h4>
                  {row.stock_name && (
                    <p className="text-xs text-[#64748B] mt-0.5 truncate max-w-[140px]">{row.stock_name}</p>
                  )}
                </div>
                {row.avg_target_price !== null && (
                  <div className="text-right">
                    <div className="text-[10px] text-[#64748B] uppercase tracking-wider">PT</div>
                    <div className="font-[family-name:var(--font-geist-mono)] text-sm font-semibold text-[#F1F5F9]">
                      ${row.avg_target_price.toFixed(0)}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-auto pt-2 flex flex-col gap-2">
                <PulseBar value={row.consensus_sentiment} />
                <div className="flex justify-between items-end">
                  {isBlank ? (
                    <span className="text-xs text-[#64748B]">No recent data</span>
                  ) : (
                    <span className={getSentimentBadgeClass(row.consensus_sentiment)}>
                      {getSentimentLabel(row.consensus_sentiment)}
                    </span>
                  )}
                  <span className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[#64748B]">
                    {row.mention_count} Mentions
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
