'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Activity } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { RADARS } from '@/lib/radars'
import RadarCard from '@/components/ui/radar-card'
import { AggregatedTicker, RecommendationRow } from '@/lib/types'

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
  return results
}

export default function RadarsIndexPage() {
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
      
      const agg = data ? aggregateRecommendations(data as unknown as RecommendationRow[]) : []
      setAggregated(agg)
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0F1A]">
        <Activity className="w-8 h-8 text-[#00D4AA] animate-spin" />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#0A0F1A] text-[#E2E8F0] p-4 md:p-8 font-[family-name:var(--font-geist-sans)] selection:bg-[#00D4AA]/30">
      <div className="max-w-6xl mx-auto pt-6 pb-20">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[#64748B] hover:text-[#00D4AA] transition-colors mb-12 uppercase tracking-widest font-semibold">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          Back to Dashboard
        </Link>

        <header className="mb-12 animate-fade-up">
          <h1 className="text-5xl md:text-7xl font-light tracking-tight text-[#F1F5F9] mb-4">
            Stock <span className="font-medium bg-gradient-to-r from-[#00D4AA] to-[#00FFD0] text-transparent bg-clip-text">Radars</span>
          </h1>
          <p className="text-lg text-[#8B95A8] max-w-2xl leading-relaxed">
            Curated micro-universes of stocks. Track the collective YouTube sentiment of the market&apos;s most important narratives in real-time.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-fade-up stagger-2">
          {RADARS.map(radar => (
            <RadarCard key={radar.slug} config={radar} tickers={aggregated} />
          ))}
        </div>
      </div>
    </main>
  )
}
