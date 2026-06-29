export interface RecommendationRow {
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

export interface AggregatedTicker {
  ticker: string
  stock_name: string
  consensus_sentiment: number
  avg_target_price: number | null
  avg_conviction: number
  mention_count: number
  analyst_count: number
  current_price?: number | null
  price_change_pct?: number | null
  price_fetched_at?: string | null
}

export interface RadarTrendPoint {
  date: string
  aura_score: number
}

export interface PlayResponse {
  ticker: string
  stock_name: string
  direction: string
  aura_score: number
  omni_score: number
  action_label: string
  consensus_sentiment: number
  avg_conviction: number
  avg_target_price: number | null
  recent_mentions: number
  analyst_count: number
  agreement_pct: number
  top_catalyst: string
  current_price?: number | null
  price_change_pct?: number | null
  price_fetched_at?: string | null
}

export interface RadarResponse {
  name: string
  slug: string
  description: string
  tickers: string[]
  theme_color: string
  icon: string
  category: string
  sentiment_pulse: number
  aura_score: number
  omni_score: number
  volume: number
  trend: RadarTrendPoint[]
  plays: PlayResponse[]
}

export interface StockDirectoryItem {
  ticker: string
  stock_name: string | null
  tier: number
  is_pinned: boolean
  priority_score: number
  mention_count_30d: number
  analyst_count: number
  last_mentioned_at: string | null
  current_price: number | null
  price_change_pct: number | null
  price_fetched_at: string | null
  overall_sentiment: number | null
  avg_target_price: number | null
  avg_conviction: number | null
}
