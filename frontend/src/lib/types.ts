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
}
