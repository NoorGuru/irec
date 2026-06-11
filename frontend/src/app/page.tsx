import Link from "next/link"
import { createClient } from "@/lib/supabase/server"

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
    const consensus_sentiment =
      totalWeight > 0
        ? Math.round((weightedSum / totalWeight) * 100) / 100
        : 0

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

export default async function Home() {
  const supabase = await createClient()

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

  const aggregated = recommendations
    ? aggregateRecommendations(recommendations as unknown as RecommendationRow[])
    : []

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">
          YTPortfolio - Stock Recommendations
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
                    Consensus Sentiment
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
                        href={`/ticker/${row.ticker}`}
                        className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {row.ticker}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100">
                      {row.consensus_sentiment.toFixed(2)}
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
      </div>
    </div>
  )
}
