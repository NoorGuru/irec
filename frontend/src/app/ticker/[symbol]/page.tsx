import Link from "next/link"
import { createClient } from "@/lib/supabase/server"

interface Recommendation {
  ticker: string
  sentiment: number
  target_price: number | null
  conviction_level: number
  catalyst_notes: string
  videos: {
    published_at: string
    channels: {
      channel_name: string
    }
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function getSentimentLabel(sentiment: number): string {
  switch (sentiment) {
    case -2:
      return "Strong Sell"
    case -1:
      return "Sell"
    case 0:
      return "Neutral"
    case 1:
      return "Buy"
    case 2:
      return "Strong Buy"
    default:
      return "Unknown"
  }
}

function getSentimentColor(sentiment: number): string {
  switch (sentiment) {
    case -2:
      return "text-red-700 bg-red-100"
    case -1:
      return "text-red-600 bg-red-50"
    case 0:
      return "text-gray-600 bg-gray-100"
    case 1:
      return "text-green-600 bg-green-50"
    case 2:
      return "text-green-700 bg-green-100"
    default:
      return "text-gray-600 bg-gray-100"
  }
}

export default async function TickerPage({
  params,
}: {
  params: Promise<{ symbol: string }>
}) {
  const { symbol } = await params

  // Validate ticker: reject if >5 chars or contains non-letter characters
  const isInvalid = symbol.length > 5 || /[^a-zA-Z]/.test(symbol)

  if (isInvalid) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="mt-6 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {symbol.toUpperCase()}
          </h1>
          <p className="mt-6 text-zinc-600 dark:text-zinc-400">
            No data available for this symbol.
          </p>
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: recommendations } = await supabase
    .from("recommendations")
    .select(
      `
      ticker,
      sentiment,
      target_price,
      conviction_level,
      catalyst_notes,
      videos!inner(
        published_at,
        channels!inner(channel_name)
      )
    `
    )
    .ilike("ticker", symbol)

  // Sort by video publish date descending (most recent first)
  const sortedRecommendations = (
    (recommendations as unknown as Recommendation[]) || []
  ).sort((a, b) => {
    const dateA = new Date(a.videos.published_at).getTime()
    const dateB = new Date(b.videos.published_at).getTime()
    return dateB - dateA
  })

  if (sortedRecommendations.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="mt-6 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {symbol.toUpperCase()}
          </h1>
          <p className="mt-6 text-zinc-600 dark:text-zinc-400">
            No data available for this symbol.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Back to Dashboard
        </Link>
        <h1 className="mt-6 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          {symbol.toUpperCase()}
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {sortedRecommendations.length} recommendation
          {sortedRecommendations.length !== 1 ? "s" : ""} found
        </p>

        <div className="mt-8 space-y-6">
          {sortedRecommendations.map((rec, index) => (
            <div
              key={index}
              className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {rec.videos.channels.channel_name}
                </span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {formatDate(rec.videos.published_at)}
                </span>
              </div>

              <div className="flex flex-wrap gap-3 mb-4">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getSentimentColor(rec.sentiment)}`}
                >
                  {getSentimentLabel(rec.sentiment)} ({rec.sentiment})
                </span>
                <span className="inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
                  Conviction: {rec.conviction_level}/10
                </span>
                <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  Target:{" "}
                  {rec.target_price !== null
                    ? `$${rec.target_price.toFixed(2)}`
                    : "N/A"}
                </span>
              </div>

              {rec.catalyst_notes && (
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {rec.catalyst_notes}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
