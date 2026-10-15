export interface RecommendationRow {
  ticker: string
  stock_name: string
  sentiment: number
  target_price: number | null
  target_price_verified?: boolean | null
  is_verified?: boolean | null
  conviction_level: number
  conviction_score?: number | null
  conviction_confidence?: number | null
  sentiment_score?: number | null
  sentiment_confidence?: number | null
  quote?: string | null
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
  avg_conviction: number // 0-100
  mention_count: number
  analyst_count: number
}

export interface RadarTrendPoint {
  date: string
  aura_score: number // 0–100
}

export interface VideoSummaryInfo {
  youtube_video_id: string
  channel_name: string
  published_at: string
}

export interface CatalystOpinion {
  channel_name: string
  sentiment: number
  conviction: number
  notes: string
  published_at: string
  youtube_video_id: string
}

export interface Play {
  ticker: string
  stock_name: string
  direction: 'BUY' | 'SELL'
  aura_score: number // 0–100
  omni_score: number // 0–100
  signal_tier: string
  action_label: string
  consensus_sentiment: number
  avg_conviction: number // 0-100
  avg_target_price: number | null
  recent_mentions: number
  analyst_count: number
  agreement_pct: number
  top_catalyst: string
  catalysts?: CatalystOpinion[]
  why_bullets?: string[]
  latest_video?: VideoSummaryInfo
}

export interface MarketMood {
  buy_plays: number
  sell_plays: number
  overall: 'Bullish' | 'Bearish' | 'Neutral'
}

export interface TodayPlaysData {
  generated_at: string
  plays: Play[]
  market_mood: MarketMood
}

export type InvestorArchetype = 'all' | 'core' | 'growth' | 'value'

export interface TopAlphaPlay extends Play {
  rank: number
  apm_score: number
  archetype: 'core' | 'growth' | 'value'
  archetype_label: string
  executive_thesis: string
}

export type PlayResponse = Play



export interface RadarResponse {
  name: string
  slug: string
  description: string
  tickers: string[]
  theme_color: string
  icon: string
  category: string
  sentiment_pulse: number
  aura_score: number // 0–100
  omni_score: number // 0–100
  volume: number
  trend: RadarTrendPoint[]
  plays: PlayResponse[]
}

export interface StockDirectoryItem {
  ticker: string
  stock_name: string | null
  tier: number
  is_pinned: boolean
  priority_score: number // 0–1 ranking weight; display via formatAura() as 0–100
  mention_count_30d: number
  analyst_count: number
  last_mentioned_at: string | null
  overall_sentiment: number | null
  raw_sentiment?: number | null
  avg_target_price: number | null
  avg_conviction: number | null // 0-100
}
