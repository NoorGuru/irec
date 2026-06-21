'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'

// --- Types ---

interface VideoSummaryInfo {
  youtube_video_id: string
  channel_name: string
  published_at: string
}

interface CatalystOpinion {
  channel_name: string
  sentiment: number
  conviction: number
  notes: string
  published_at: string
  youtube_video_id: string
}

interface Play {
  ticker: string
  stock_name: string
  direction: 'BUY' | 'SELL'
  action_score: number
  action_label: string
  consensus_sentiment: number
  avg_conviction: number
  avg_target_price: number | null
  recent_mentions: number
  analyst_count: number
  agreement_pct: number
  top_catalyst: string
  catalysts?: CatalystOpinion[]
  why_bullets: string[]
  latest_video: VideoSummaryInfo
}

interface MarketMood {
  buy_plays: number
  sell_plays: number
  overall: 'Bullish' | 'Bearish' | 'Neutral'
}

interface TodayPlaysData {
  generated_at: string
  plays: Play[]
  market_mood: MarketMood
}

// --- Radial Gauge Component ---

function RadialScoreGauge({ score, direction }: { score: number; direction: 'BUY' | 'SELL' }) {
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference

  const isBuy = direction === 'BUY'

  // Dynamic color classes
  const strokeColor = isBuy
    ? 'stroke-[#00D4AA]' // Bull Green
    : 'stroke-[#FF4D6A]' // Bear Red

  const glowColor = isBuy
    ? 'rgba(0, 212, 170, 0.4)'
    : 'rgba(255, 77, 106, 0.4)'

  return (
    <div className="relative flex items-center justify-center w-16 h-16 shrink-0 select-none">
      <svg className="w-16 h-16 transform -rotate-90">
        {/* Track circle */}
        <circle
          cx="32"
          cy="32"
          r={radius}
          className="stroke-[#1E293B]"
          strokeWidth="4"
          fill="transparent"
        />
        {/* Progress circle */}
        <circle
          cx="32"
          cy="32"
          r={radius}
          className={`transition-all duration-1000 ease-out ${strokeColor}`}
          strokeWidth="4.5"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 4px ${glowColor})`,
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[#F1F5F9] leading-none">
          {score}
        </span>
      </div>
    </div>
  )
}

// --- Card Component ---

function PlayCard({ play, index }: { play: Play; index: number }) {
  const isBuy = play.direction === 'BUY'
  const isStrong = play.action_score >= 80
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`
        relative group flex flex-col rounded-2xl border border-[#1E293B] bg-[#141B2D]/50 hover:bg-[#141B2D]/80 p-5 md:p-6 transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:shadow-black/40 animate-fade-up
        ${isBuy ? 'hover:border-[#00D4AA]/30' : 'hover:border-[#FF4D6A]/30'}
      `}
      style={{
        animationDelay: `${index * 80}ms`,
      }}
    >
      {/* Top sentiment/conviction indicator band */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          {/* Ticker & Name */}
          <Link href={`/ticker?s=${play.ticker}`} className={`flex items-center gap-2 transition-colors ${isBuy ? 'group-hover:text-[#00D4AA]' : 'group-hover:text-[#FF4D6A]'}`}>
            <span className="font-[family-name:var(--font-geist-mono)] text-xl font-bold tracking-wider text-[#F1F5F9] leading-none">
              {play.ticker}
            </span>
            <span className="text-xs text-[#64748B] truncate max-w-[140px] md:max-w-[200px] mt-0.5" title={play.stock_name}>
              {play.stock_name}
            </span>
          </Link>

          {/* Action Badge & Conviction */}
          <div className="flex items-center gap-2 mt-2">
            <span
              className={`
                text-[10px] font-bold px-2 py-0.5 rounded-md tracking-wider uppercase
                ${isBuy
                  ? (isStrong ? 'bg-[#00FFD0]/10 border border-[#00FFD0]/30 text-[#00FFD0]' : 'bg-[#00D4AA]/10 border border-[#00D4AA]/20 text-[#00D4AA]')
                  : (isStrong ? 'bg-[#FF1744]/10 border border-[#FF1744]/30 text-[#FF1744]' : 'bg-[#FF4D6A]/10 border border-[#FF4D6A]/20 text-[#FF4D6A]')
                }
              `}
            >
              {play.action_label}
            </span>
            {play.avg_target_price !== null && (
              <span className="text-[10px] font-[family-name:var(--font-geist-mono)] text-[#64748B]">
                Target: <span className="text-[#F1F5F9]">${play.avg_target_price}</span>
              </span>
            )}
          </div>
        </div>

        {/* Gauge */}
        <RadialScoreGauge score={play.action_score} direction={play.direction} />
      </div>

      {/* Why bullets */}
      <div className="mb-4 space-y-1.5">
        {play.why_bullets.map((bullet, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-[#8B95A8]">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className={`mt-0.5 shrink-0 ${isBuy ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'}`}
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="leading-snug">{bullet}</span>
          </div>
        ))}
      </div>

      {/* Catalyst Box / Accordion */}
      <div className="relative mt-auto pt-3 border-t border-[#1E293B]/40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[8px] uppercase tracking-widest text-[#64748B] font-bold">
            Analyst Opinions ({(play.catalysts || []).length})
          </span>
          {play.catalysts && play.catalysts.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-[#00D4AA] hover:text-[#00FFD0] transition-colors font-semibold flex items-center gap-1 select-none"
            >
              <span>{expanded ? 'Hide Opinions' : 'View All'}</span>
              <svg
                width="8"
                height="8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
        </div>

        {!expanded ? (
          <p className="text-xs text-[#64748B] italic leading-relaxed pl-1 line-clamp-3">
            &ldquo;{play.top_catalyst}&rdquo;
          </p>
        ) : (
          <div className="space-y-3 mt-2 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#1E293B]">
            {(play.catalysts || []).map((c, i) => {
              return (
                <div key={i} className="text-xs border-l-2 border-[#1E293B] pl-2 py-0.5 space-y-1">
                  <div className="flex items-center justify-between text-[9px] text-[#64748B]">
                    <Link
                      href={`/video?id=${c.youtube_video_id}`}
                      className="font-bold text-[#8B95A8] hover:text-[#00D4AA] transition-colors"
                    >
                      {c.channel_name}
                    </Link>
                    <span className="font-[family-name:var(--font-geist-mono)]">
                      Conviction: <span className="text-[#F1F5F9]">{c.conviction}/10</span>
                    </span>
                  </div>
                  <p className="text-[#8B95A8] italic">&ldquo;{c.notes}&rdquo;</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Video / Channel source row */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#1E293B]/20 text-[10px] text-[#64748B] font-[family-name:var(--font-geist-mono)]">
        <span className="truncate max-w-[150px]">
          Source: <span className="text-[#8B95A8]">{play.latest_video.channel_name}</span>
        </span>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/video?id=${play.latest_video.youtube_video_id}`}
            className="flex items-center gap-1 text-[#64748B] hover:text-[#00D4AA] transition-colors"
            title="View video details"
          >
            <span>Analysis</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="3" />
              <path d="M10 9l5 3-5 3V9z" fill="currentColor" />
            </svg>
          </Link>
          <span className="text-[#374151]">•</span>
          <a
            href={`https://youtube.com/watch?v=${play.latest_video.youtube_video_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[#64748B] hover:text-red-400 transition-colors"
            title="Watch on YouTube"
          >
            <span>YouTube</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  )
}

// --- Skeleton Loader Component ---

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-[#1E293B] bg-[#141B2D]/30 p-5 md:p-6 space-y-4 animate-pulse">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-6 w-24 bg-[#1E293B] rounded" />
          <div className="h-3 w-40 bg-[#1E293B] rounded" />
        </div>
        <div className="w-14 h-14 bg-[#1E293B] rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-[#1E293B] rounded" />
        <div className="h-3 w-[90%] bg-[#1E293B] rounded" />
      </div>
      <div className="pt-4 border-t border-[#1E293B]/40 space-y-1.5">
        <div className="h-3 w-[60%] bg-[#1E293B] rounded" />
        <div className="h-2 w-full bg-[#1E293B] rounded" />
      </div>
    </div>
  )
}

// --- Main Page Component ---

type SortOption = 'action_score' | 'mentions' | 'conviction' | 'consensus_sentiment'

export default function TodayPlaysPage() {
  const [data, setData] = useState<TodayPlaysData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('action_score')
  const [activeTab, setActiveTab] = useState<'BUY' | 'SELL'>('BUY')

  useEffect(() => {
    async function fetchPlays() {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
        const res = await fetch(`${backendUrl}/api/v1/today`)

        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`)
        }

        const json = await res.json()
        setData(json)
      } catch (err: any) {
        logger.error('Failed to fetch today\'s plays:', err)
        setError(err.message || 'Unable to connect to the backend server.')
      } finally {
        setLoading(false)
      }
    }

    fetchPlays()
  }, [])

  // Client-side sorting logic
  const sortPlays = (playsList: Play[]) => {
    return [...playsList].sort((a, b) => {
      if (sortBy === 'action_score') {
        return b.action_score - a.action_score
      } else if (sortBy === 'mentions') {
        return b.recent_mentions - a.recent_mentions
      } else if (sortBy === 'conviction') {
        return b.avg_conviction - a.avg_conviction
      } else if (sortBy === 'consensus_sentiment') {
        return Math.abs(b.consensus_sentiment) - Math.abs(a.consensus_sentiment)
      }
      return 0
    })
  }

  // Partition plays into Buy vs Sell with client-side sorting applied
  const buyPlays = data ? sortPlays(data.plays.filter((p) => p.direction === 'BUY')) : []
  const sellPlays = data ? sortPlays(data.plays.filter((p) => p.direction === 'SELL')) : []

  // Dynamic theme variables based on active tab
  const isBuyTab = activeTab === 'BUY'
  const activeLabel = isBuyTab ? 'buy' : 'sell'
  const activeColorText = isBuyTab ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'
  const activeColorBg = isBuyTab ? 'bg-[#00D4AA]' : 'bg-[#FF4D6A]'
  const activeColorBorder = isBuyTab ? 'border-[#00D4AA]/20' : 'border-[#FF4D6A]/20'
  const activeColorBorderStrong = isBuyTab ? 'border-[#00D4AA]/50' : 'border-[#FF4D6A]/50'
  const activeColorBgOpacity = isBuyTab ? 'bg-[#00D4AA]/10' : 'bg-[#FF4D6A]/10'
  const activeRing = isBuyTab ? 'ring-[#00D4AA]/30' : 'ring-[#FF4D6A]/30'
  const activeShadow = isBuyTab ? 'shadow-[0_0_15px_rgba(0,212,170,0.1)]' : 'shadow-[0_0_15px_rgba(255,77,106,0.1)]'
  const activeShadowStrong = isBuyTab ? 'shadow-[0_0_30px_rgba(0,212,170,0.2)]' : 'shadow-[0_0_30px_rgba(255,77,106,0.2)]'
  const activeGradient = isBuyTab ? 'from-[#00D4AA]/0 via-[#00D4AA]/5 to-[#00D4AA]/0' : 'from-[#FF4D6A]/0 via-[#FF4D6A]/5 to-[#FF4D6A]/0'
  const activeGlowBg = isBuyTab ? 'bg-[#00D4AA]/5' : 'bg-[#FF4D6A]/5'
  const activeVia = isBuyTab ? 'via-[#00D4AA]' : 'via-[#FF4D6A]'
  
  const isActionScore = sortBy === 'action_score'

  // Market mood display details (Calculates a precise ratio and randomly selects a punchy description)
  const moodConfig = useMemo(() => {
    if (!data) return null

    const buyCount = data.market_mood.buy_plays
    const sellCount = data.market_mood.sell_plays
    const total = buyCount + sellCount

    if (total === 0) {
      return {
        color: 'text-[#8B95A8]',
        glow: 'from-[#8B95A8]/10 to-[#141B2D]/5',
        title: 'Insufficient Data',
        byline: 'Not enough data to determine market consensus.',
        scoreText: '0 plays',
      }
    }

    const buyRatio = buyCount / total
    const scoreText = `${Math.round(buyRatio * 100)}% Bullish Bias`
    const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]

    if (buyRatio >= 0.8) {
      return {
        color: 'text-[#00D4AA] sentiment-strong-buy',
        glow: 'from-[#00D4AA]/20 to-[#00FFD0]/5',
        title: 'Extreme Bullish',
        byline: pick([
          "Massive buy consensus. Analysts are pounding the table.",
          "Unwavering bullish sentiment. Almost zero sell signals today.",
          "Extreme upside conviction. The market is overwhelmingly green."
        ]),
        scoreText,
      }
    } else if (buyRatio > 0.55) {
      return {
        color: 'text-[#00D4AA] sentiment-strong-buy',
        glow: 'from-[#00D4AA]/20 to-[#00FFD0]/5',
        title: 'Bullish',
        byline: pick([
          "Clear buy bias. Analysts are leaning heavily positive.",
          "Solid bullish momentum. Buy signals dominate today.",
          "More upgrades than downgrades. Market leans green."
        ]),
        scoreText,
      }
    } else if (buyRatio <= 0.2) {
      return {
        color: 'text-[#FF4D6A] sentiment-strong-sell',
        glow: 'from-[#FF4D6A]/20 to-[#FF1744]/5',
        title: 'Extreme Bearish',
        byline: pick([
          "Massive sell consensus. Analysts are heading for the exits.",
          "Unwavering bearish sentiment. Almost zero buy signals today.",
          "Extreme downside conviction. Defensive positioning recommended."
        ]),
        scoreText,
      }
    } else if (buyRatio < 0.45) {
      return {
        color: 'text-[#FF4D6A] sentiment-strong-sell',
        glow: 'from-[#FF4D6A]/20 to-[#FF1744]/5',
        title: 'Bearish',
        byline: pick([
          "Clear sell bias. Analysts are leaning heavily negative.",
          "Solid bearish momentum. Sell signals dominate today.",
          "Downgrades outpace upgrades. Proceed with caution."
        ]),
        scoreText,
      }
    } else {
      return {
        color: 'text-[#8B95A8]',
        glow: 'from-[#8B95A8]/10 to-[#141B2D]/5',
        title: 'Mixed / Neutral',
        byline: pick([
          "Mixed signals. Analysts are deeply divided on market direction.",
          "No clear consensus. A tug-of-war between bulls and bears.",
          "Deadlocked. Equal buy and sell pressure today."
        ]),
        scoreText,
      }
    }
  }, [data])

  return (
    <main className="flex-1 w-full mx-auto relative">
      {/* 🚀 CRAZY GOD-MODE ACTION SCORE BACKGROUND 🚀 */}
      {isActionScore && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden animate-fade-in mix-blend-screen opacity-80 transition-all duration-1000">
          {/* Moving Matrix-style Data Grid */}
          <div 
            className="absolute inset-[-100%] animate-[spin_90s_linear_infinite]"
            style={{
               backgroundImage: `linear-gradient(${isBuyTab ? 'rgba(0,212,170,0.07)' : 'rgba(255,77,106,0.07)'} 1px, transparent 1px), linear-gradient(90deg, ${isBuyTab ? 'rgba(0,212,170,0.07)' : 'rgba(255,77,106,0.07)'} 1px, transparent 1px)`,
               backgroundSize: '40px 40px',
               backgroundPosition: 'center center',
            }}
          />
          {/* Massive Pulsing Radial Beam */}
          <div className={`absolute -top-[20%] left-1/2 -translate-x-1/2 w-[120vw] h-[800px] bg-[radial-gradient(ellipse_at_top,${isBuyTab ? 'rgba(0,212,170,0.15)' : 'rgba(255,77,106,0.15)'}_0%,transparent_70%)] animate-pulse`} />
          {/* Deep Space Vignette to keep content readable */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(10,15,26,0.9)_100%)]" />
        </div>
      )}

      <div className="w-full max-w-6xl mx-auto px-4 md:px-8 py-8 relative z-10">
        {/* Header section / The Verdict */}
        <section className="relative rounded-3xl border border-[#1E293B]/80 bg-[#141B2D]/40 overflow-hidden mb-12 p-8 md:p-12 animate-fade-up">
        {/* Glow effect backdrops */}
        {data && (
          <>
            <div className={`absolute top-0 right-1/4 w-[350px] h-[350px] rounded-full blur-[100px] pointer-events-none bg-gradient-to-br ${moodConfig?.glow} opacity-60`} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(0,212,170,0.02),transparent_40%)] pointer-events-none" />
          </>
        )}

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-2 h-2 rounded-full bg-[#00D4AA] animate-pulse" />
              <h1 className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#64748B]">
                Daily Action Verdict
              </h1>
            </div>

            {loading ? (
              <div className="space-y-3">
                <div className="h-12 w-64 bg-[#1E293B] rounded animate-pulse" />
                <div className="h-4 w-96 bg-[#1E293B]/60 rounded animate-pulse" />
              </div>
            ) : error ? (
              <div>
                <h2 className="text-2xl font-bold text-[#FF4D6A]">Connection Offline</h2>
                <p className="text-sm text-[#64748B] mt-1">
                  Could not load market verdict. {error}
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-baseline gap-3">
                  <span className={`text-4xl md:text-5xl lg:text-6xl font-black tracking-tight ${moodConfig?.color}`}>
                    {moodConfig?.title}
                  </span>
                  <span className="text-sm text-[#64748B] font-light font-[family-name:var(--font-geist-mono)]">
                    &bull; {moodConfig?.scoreText}
                  </span>
                </div>
                <p className="text-sm text-[#8B95A8] mt-3 max-w-xl leading-relaxed">
                  {moodConfig?.byline}
                </p>
              </div>
            )}
          </div>

          {/* Quick stats panel */}
          {!loading && !error && data && (
            <div className="flex items-center gap-6 divide-x divide-[#1E293B]/80 rounded-2xl border border-[#1E293B] bg-[#0A0F1A]/60 p-5 shrink-0 self-start md:self-auto font-[family-name:var(--font-geist-mono)]">
              <div className="flex flex-col">
                <span className="text-2xl font-extrabold text-[#00D4AA]">{buyPlays.length}</span>
                <span className="text-[9px] uppercase tracking-wider text-[#64748B] mt-0.5">Buy Plays</span>
              </div>
              <div className="flex flex-col pl-6">
                <span className="text-2xl font-extrabold text-[#FF4D6A]">{sellPlays.length}</span>
                <span className="text-[9px] uppercase tracking-wider text-[#64748B] mt-0.5">Sell Plays</span>
              </div>
              <div className="flex flex-col pl-6">
                <span className="text-xs text-[#8B95A8] font-bold">
                  {new Date(data.generated_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-[#64748B] mt-0.5">Last Updated</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Sort Options and Dynamic Insights Panel */}
      {!loading && !error && data && (data.plays.length > 0) && (
        <div className="flex flex-col gap-3 mb-8 animate-fade-up">
          {/* Main Sort Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-[#1E293B]/40 bg-[#0A0F1A]/30 transition-colors duration-300">
            <div className="text-xs text-[#64748B] font-[family-name:var(--font-geist-mono)] flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${activeColorBg} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${activeColorBg}`}></span>
              </span>
              Displaying top-tier {activeLabel} opportunities
            </div>

            <div className="flex flex-wrap items-center gap-1.5 bg-[#0A0F1A]/80 border border-[#1E293B] rounded-xl p-1 text-xs select-none">
              <span className="text-[#64748B] px-2 font-medium">Sort Strategy:</span>
              {(
                [
                  { key: 'action_score', label: 'Action Score' },
                  { key: 'mentions', label: 'Mentions' },
                  { key: 'conviction', label: 'Conviction' },
                  { key: 'consensus_sentiment', label: 'Sentiment' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all duration-300 relative overflow-hidden ${sortBy === opt.key
                      ? `bg-[#141B2D] ${activeColorText} ring-1 ${activeRing} ${activeShadow}`
                      : 'text-[#64748B] hover:text-[#F1F5F9] hover:bg-[#141B2D]/50'
                    }`}
                >
                  {sortBy === opt.key && (
                    <div className={`absolute inset-0 bg-gradient-to-r ${activeGradient} pointer-events-none`} />
                  )}
                  <span className="relative z-10">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Sort Explanation Panel */}
          <div className={`relative overflow-hidden rounded-xl border ${isActionScore ? `${activeColorBorderStrong} ${activeShadowStrong}` : 'border-[#1E293B]/60 hover:border-[#1E293B]'} bg-gradient-to-br from-[#141B2D]/80 to-[#0A0F1A]/80 p-4 md:p-5 transition-all duration-500`}>
            
            {/* Live Scanline & Glow Effects for Action Score */}
            {isActionScore && (
              <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${activeVia} to-transparent opacity-60`} />
                <div className={`absolute -inset-x-[150%] top-0 bottom-0 bg-gradient-to-r from-transparent ${activeColorBgOpacity} to-transparent opacity-40 animate-pulse skew-x-12`} />
              </div>
            )}

            {/* Subtle glow effect behind the text */}
            <div className={`absolute top-0 left-1/4 w-[200px] h-full ${activeGlowBg} blur-3xl pointer-events-none transition-transform duration-700 ease-in-out`}
              style={{ transform: `translateX(${['action_score', 'mentions', 'conviction', 'consensus_sentiment'].indexOf(sortBy) * 50}%)` }}
            />

            <div className="relative flex items-start sm:items-center gap-3">
              <div className={`shrink-0 mt-0.5 sm:mt-0 p-1.5 rounded-lg ${activeColorBgOpacity} ${activeColorText} border ${activeColorBorder} transition-colors duration-300`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-xs md:text-sm text-[#8B95A8] leading-relaxed transition-opacity duration-300 flex-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="shrink-0 sm:w-32 border-b sm:border-b-0 sm:border-r border-[#1E293B] pb-1 sm:pb-0 sm:pr-4 flex items-center justify-between">
                  <strong className="text-[#F1F5F9] font-bold tracking-widest uppercase text-[11px] sm:text-xs">
                    {sortBy === 'action_score' && "Action Score"}
                    {sortBy === 'mentions' && "Mentions"}
                    {sortBy === 'conviction' && "Conviction"}
                    {sortBy === 'consensus_sentiment' && "Pure Sentiment"}
                  </strong>
                </div>
                <span className="animate-fade-in flex-1">
                  {sortBy === 'action_score' && (
                    <span className="flex flex-col gap-1.5">
                      <span>Our exclusive rating blending {activeLabel} conviction, consensus, and momentum to give you the ultimate edge.</span>
                      <span className={`${activeColorText} font-semibold text-[10px] sm:text-[11px] tracking-wide transition-colors uppercase`}>Use this when: You want the ultimate, well-rounded &ldquo;{activeLabel} now&rdquo; signal.</span>
                    </span>
                  )}
                  {sortBy === 'mentions' && (
                    <span className="flex flex-col gap-1.5">
                      <span>Ranks {isBuyTab ? 'bullish' : 'bearish'} plays strictly by the volume of recent analyst chatter and coverage.</span>
                      <span className={`${activeColorText} font-semibold text-[10px] sm:text-[11px] tracking-wide transition-colors uppercase`}>Use this when: You want to track what&apos;s currently buzzing in the community.</span>
                    </span>
                  )}
                  {sortBy === 'conviction' && (
                    <span className="flex flex-col gap-1.5">
                      <span>Prioritizes plays where analysts express the highest levels of absolute certainty {isBuyTab ? 'for a massive upside' : 'for a severe downside'}.</span>
                      <span className={`${activeColorText} font-semibold text-[10px] sm:text-[11px] tracking-wide transition-colors uppercase`}>Use this when: You are looking for hidden gems with unwavering {isBuyTab ? 'bullish' : 'bearish'} belief.</span>
                    </span>
                  )}
                  {sortBy === 'consensus_sentiment' && (
                    <span className="flex flex-col gap-1.5">
                      <span>Sorts by pure {isBuyTab ? 'bullishness' : 'bearishness'}, ignoring video age or total volume of mentions.</span>
                      <span className={`${activeColorText} font-semibold text-[10px] sm:text-[11px] tracking-wide transition-colors uppercase`}>Use this when: You want to find plays with the most overwhelmingly {isBuyTab ? 'positive' : 'negative'} consensus.</span>
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Swim Lanes section */}
      {loading ? (
        <div className="space-y-8">
          <div className="flex gap-6 mb-4 border-b border-[#1E293B]/60 pb-px">
            <div className="h-8 w-32 bg-[#1E293B] rounded-t-lg" />
            <div className="h-8 w-32 bg-[#1E293B] rounded-t-lg" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      ) : error ? (
        <div className="text-center py-16 border border-[#1E293B] bg-[#141B2D]/10 rounded-2xl">
          <svg className="w-12 h-12 mx-auto text-[#FF4D6A] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
            <path d="M12 9v4M12 17h.01" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <h3 className="text-lg font-bold text-[#F1F5F9]">Failed to Load Today&apos;s Plays</h3>
          <p className="text-sm text-[#64748B] mt-2 max-w-md mx-auto">
            {error}. Ensure your backend server is running and accessible.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 text-xs font-semibold rounded-lg bg-[#00D4AA]/10 hover:bg-[#00D4AA]/20 text-[#00D4AA] border border-[#00D4AA]/30 transition-all duration-200"
          >
            Retry Connection
          </button>
        </div>
      ) : buyPlays.length === 0 && sellPlays.length === 0 ? (
        <div className="text-center py-16 border border-[#1E293B] bg-[#141B2D]/20 rounded-3xl">
          <svg className="w-12 h-12 mx-auto text-[#64748B] mb-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
            <path d="M8 12h8" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <h3 className="text-lg font-bold text-[#F1F5F9]">No Actionable Plays Found</h3>
          <p className="text-sm text-[#64748B] mt-2 max-w-sm mx-auto">
            We couldn&apos;t find enough recent analyst recommendations (needs at least 2 recommendations per stock within the last 30 days).
          </p>
          <p className="text-xs text-[#475569] mt-2">
            Try importing or ingesting some recent video transcripts in the Admin panel.
          </p>
          <div className="flex justify-center gap-4 mt-6">
            <Link
              href="/"
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#1E293B] text-[#8B95A8] hover:text-[#F1F5F9] hover:bg-[#141B2D] transition-all"
            >
              Go to Explorer
            </Link>
            <Link
              href="/admin/ingest"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#00D4AA] text-[#0A0F1A] hover:opacity-90 transition-all"
            >
              Ingest Videos
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-fade-up">
          {/* Tabs Selector */}
          <div className="flex items-center justify-center sm:justify-start gap-6 border-b border-[#1E293B]/60 pb-px select-none">
            <button
              onClick={() => setActiveTab('BUY')}
              className={`pb-4 px-2 text-sm font-bold tracking-wide transition-all duration-300 relative ${activeTab === 'BUY' ? 'text-[#00D4AA]' : 'text-[#64748B] hover:text-[#8B95A8]'
                }`}
            >
              BUY PLAYS
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] transition-colors ${activeTab === 'BUY' ? 'bg-[#00D4AA]/10 text-[#00D4AA] border border-[#00D4AA]/20' : 'bg-[#1E293B] text-[#8B95A8] border border-transparent'
                }`}>
                {buyPlays.length}
              </span>
              {activeTab === 'BUY' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00D4AA] shadow-[0_-2px_10px_rgba(0,212,170,0.5)] animate-fade-in" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('SELL')}
              className={`pb-4 px-2 text-sm font-bold tracking-wide transition-all duration-300 relative ${activeTab === 'SELL' ? 'text-[#FF4D6A]' : 'text-[#64748B] hover:text-[#8B95A8]'
                }`}
            >
              SELL PLAYS
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] transition-colors ${activeTab === 'SELL' ? 'bg-[#FF4D6A]/10 text-[#FF4D6A] border border-[#FF4D6A]/20' : 'bg-[#1E293B] text-[#8B95A8] border border-transparent'
                }`}>
                {sellPlays.length}
              </span>
              {activeTab === 'SELL' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF4D6A] shadow-[0_-2px_10px_rgba(255,77,106,0.5)] animate-fade-in" />
              )}
            </button>
          </div>

          {/* Active Tab Content - Grid Layout */}
          <div key={sortBy} className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
            {activeTab === 'BUY' && (
              buyPlays.length > 0 ? (
                buyPlays.map((play, idx) => (
                  <PlayCard key={play.ticker} play={play} index={idx} />
                ))
              ) : (
                <div className="col-span-full flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#1E293B]/60 bg-[#141B2D]/30 p-16 text-center animate-fade-in relative overflow-hidden group">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,212,170,0.05)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                  <svg className="w-10 h-10 text-[#64748B] mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-base font-bold text-[#F1F5F9] mb-1">No Actionable Buy Plays</div>
                  <div className="text-sm text-[#8B95A8] max-w-sm leading-relaxed">No recent buy recommendations met our strict criteria today. Check back later as new data flows in!</div>
                </div>
              )
            )}

            {activeTab === 'SELL' && (
              sellPlays.length > 0 ? (
                sellPlays.map((play, idx) => (
                  <PlayCard key={play.ticker} play={play} index={idx} />
                ))
              ) : (
                <div className="col-span-full flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#1E293B]/60 bg-[#141B2D]/30 p-16 text-center animate-fade-in relative overflow-hidden group">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,77,106,0.05)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                  <svg className="w-10 h-10 text-[#64748B] mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-base font-bold text-[#F1F5F9] mb-1">No Actionable Sell Plays</div>
                  <div className="text-sm text-[#8B95A8] max-w-sm leading-relaxed">No recent sell recommendations met our strict criteria today. Check back later as new data flows in!</div>
                </div>
              )
            )}
          </div>
        </div>
      )}
      </div>
    </main>
  )
}
const logger = {
  error: (msg: string, ...args: any[]) => {
    console.error(msg, ...args)
  }
}
