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
    const rawSentiment =
      totalWeight > 0
        ? weightedSum / totalWeight
        : 0

    // Apply confidence dampening: score regresses toward 0 with fewer mentions.
    // At 1 mention, confidence = 0.33; at 2 = 0.5; at 3+ = full confidence.
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

  // Sort by mention count descending
  results.sort((a, b) => b.mention_count - a.mention_count)

  return results
}

function SentimentBadge({ value, mentions }: { value: number; mentions: number }) {
  let label: string
  let colorClass: string

  if (value >= 1.5) {
    label = "Strong Buy"
    colorClass = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
  } else if (value >= 0.5) {
    label = "Buy"
    colorClass = "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300"
  } else if (value > -0.5) {
    label = "Neutral"
    colorClass = "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
  } else if (value > -1.5) {
    label = "Sell"
    colorClass = "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"
  } else {
    label = "Strong Sell"
    colorClass = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
  }

  // Low confidence indicator for single mentions
  if (mentions < 3) {
    label += " *"
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${colorClass}`}>
      {label}
      <span className="text-[10px] opacity-70">({value.toFixed(2)})</span>
    </span>
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

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8 flex items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">
          Aura — Stock Recommendations
        </h1>

        {aggregated.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400 text-lg">
            No stock recommendations are available yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left">
              <thead className="bg-zinc-100 dark:bg-zinc-900">
                <tr>
                  <th className="px-6 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Ticker
                  </th>
                  <th className="px-6 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    <span title="Weighted average sentiment across all mentions. Scale: -2 (Strong Sell) to +2 (Strong Buy), weighted by channel trust.">
                      Consensus Sentiment
                    </span>
                  </th>
                  <th className="px-6 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Avg Target Price
                  </th>
                  <th className="px-6 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Mentions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {aggregated.map((row) => (
                  <tr
                    key={row.ticker}
                    className="bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/ticker?s=${row.ticker}`}
                        className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {row.ticker}
                      </Link>
                      <a
                        href={`https://finance.yahoo.com/quote/${row.ticker}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                        title="View on Yahoo Finance"
                      >
                        Yahoo ↗
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      <SentimentBadge value={row.consensus_sentiment} mentions={row.mention_count} />
                    </td>
                    <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100">
                      {row.avg_target_price !== null
                        ? `$${row.avg_target_price.toFixed(2)}`
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100">
                      {row.mention_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="mt-12 border-t border-zinc-200 dark:border-zinc-800 pt-6">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
            How Consensus Sentiment Works
          </h2>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1.5">
            <p>
              <strong>What it means:</strong> Consensus Sentiment reflects the overall market opinion on a stock, aggregated from YouTube analysts. The scale ranges from −2 (Strong Sell) to +2 (Strong Buy).
            </p>
            <p>
              <strong>How we calculate it:</strong> We average the sentiment score (−2 to +2) across all analyst mentions, then apply a confidence factor based on the number of mentions. With 1 mention the score is dampened to ⅓ of its value, at 2 mentions to ½, and at 3+ mentions the full average is shown.
            </p>
            <p>
              <strong>When it updates:</strong> Scores are recalculated on every page load using all stored recommendations. New data is added each time a video is ingested through the admin panel.
            </p>
            <p>
              <strong>*</strong> Ratings marked with an asterisk are based on fewer than 3 mentions and may not represent a true consensus.
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
