'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity, Grid, Layers, ChevronLeft, ChevronRight, Info, AlertTriangle, Sparkles,
  ArrowRight, ArrowLeft, Maximize
} from 'lucide-react'

// Custom Youtube Icon SVG
function YoutubeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

import HolographicCard from '@/components/HolographicCard'
import TextScramble from '@/components/TextScramble'
import PulseField from '@/components/PulseField'
import { formatRelativeTime, formatLocalTime } from '@/lib/utils'

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
  aura_score: number
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
  current_price?: number | null
  price_change_pct?: number | null
  price_fetched_at?: string | null
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

// --- Upgraded Aura Reactor Gauge ---

function AuraReactor({ score, direction }: { score: number; direction: 'BUY' | 'SELL' }) {
  const isBuy = direction === 'BUY'
  const baseColor = isBuy ? '#00D4AA' : '#FF4D6A'
  const glowColor = isBuy ? 'rgba(0, 212, 170, 0.4)' : 'rgba(255, 77, 106, 0.4)'

  // Faster pulse for higher conviction
  const pulseDuration = `${Math.max(0.6, 2.2 - (score / 100) * 1.5)}s`

  return (
    <div className="relative flex items-center justify-center w-16 h-16 shrink-0 select-none">
      {/* Reactor Rings */}
      <div
        className="absolute inset-0 rounded-full border border-dashed opacity-25 animate-[spin_25s_linear_infinite]"
        style={{ borderColor: baseColor }}
      />
      <div
        className="absolute inset-2 rounded-full border opacity-30 animate-ping"
        style={{
          borderColor: baseColor,
          animationDuration: pulseDuration
        }}
      />
      <div
        className="absolute inset-3 rounded-full opacity-20 blur-md"
        style={{
          backgroundColor: baseColor,
          boxShadow: `0 0 12px 4px ${glowColor}`
        }}
      />

      {/* SVG Arc Gauge */}
      <svg className="w-14 h-14 transform -rotate-90 relative z-10">
        <circle
          cx="28"
          cy="28"
          r="21"
          className="stroke-[#1E293B]"
          strokeWidth="3.5"
          fill="transparent"
        />
        <circle
          cx="28"
          cy="28"
          r="21"
          stroke={baseColor}
          strokeWidth="4"
          fill="transparent"
          strokeDasharray={2 * Math.PI * 21}
          strokeDashoffset={2 * Math.PI * 21 - (score / 100) * (2 * Math.PI * 21)}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 3px ${glowColor})`,
          }}
        />
      </svg>

      {/* Score Text */}
      <div className="absolute flex flex-col items-center justify-center z-20">
        <span className="font-[family-name:var(--font-geist-mono)] text-xs font-black text-[#F1F5F9] leading-none">
          {score}
        </span>
      </div>
    </div>
  )
}



// --- HUD PlayCard Component ---

function PlayCard({ play, index, activeSortBy }: { play: Play; index: number; activeSortBy: SortOption }) {
  const router = useRouter()
  const isBuy = play.direction === 'BUY'
  const isStrong = play.aura_score >= 80

  const handleCardClick = () => {
    router.push(`/ticker?s=${play.ticker}`)
  }

  // Find channel and details matching the top catalyst
  const catalystMatch = play.catalysts?.find(c => c.notes === play.top_catalyst)
  const catalystAuthor = catalystMatch
    ? catalystMatch.channel_name
    : (play.catalysts?.[0]?.channel_name || play.latest_video.channel_name)
  const catalystConviction = catalystMatch
    ? catalystMatch.conviction
    : (play.catalysts?.[0]?.conviction || play.avg_conviction)
  const catalystVideoId = catalystMatch
    ? catalystMatch.youtube_video_id
    : (play.catalysts?.[0]?.youtube_video_id || play.latest_video.youtube_video_id)

  return (
    <HolographicCard
      onClick={handleCardClick}
      direction={play.direction}
      isStrong={isStrong}
      className="h-full flex flex-col justify-between"
    >
      <div>
        {/* Header: Ticker & Name */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-[family-name:var(--font-geist-mono)] text-2xl font-black tracking-widest text-[#F1F5F9] leading-none">
                <TextScramble text={play.ticker} />
              </span>
              <span className="text-[10px] text-[#94A3B8] font-bold truncate max-w-[110px]" title={play.stock_name}>
                {play.stock_name}
              </span>
            </div>
            
            {play.current_price != null && (
              <div className="relative group/price flex flex-col mt-3 bg-[#0A0F1A]/80 backdrop-blur-xl border border-white/5 rounded-xl p-2.5 w-max overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.3)]">
                {/* Ambient background glow based on sentiment */}
                {play.price_change_pct != null && (
                  <div 
                    className={`absolute inset-0 opacity-20 group-hover/price:opacity-30 transition-opacity duration-500 blur-xl ${
                      play.price_change_pct >= 0 ? 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#00D4AA]/40 to-transparent' : 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#FF4D6A]/40 to-transparent'
                    }`}
                  />
                )}
                
                <div className="relative z-10 flex items-end gap-2.5">
                  <span className="font-[family-name:var(--font-geist-mono)] text-xl font-black text-[#F1F5F9] leading-none tracking-tighter drop-shadow-md">
                    ${play.current_price.toFixed(2)}
                  </span>
                  {play.price_change_pct != null && (
                    <span 
                      className={`flex items-center gap-1 font-[family-name:var(--font-geist-mono)] text-xs font-bold mb-0.5 px-1.5 py-0.5 rounded-md border backdrop-blur-md ${
                        play.price_change_pct >= 0 
                          ? 'bg-[#00D4AA]/10 text-[#00FFD0] border-[#00D4AA]/20 shadow-[0_0_10px_rgba(0,212,170,0.1)]' 
                          : 'bg-[#FF4D6A]/10 text-[#FF4D6A] border-[#FF4D6A]/20 shadow-[0_0_10px_rgba(255,77,106,0.1)]'
                      }`}
                      title="Change since market open"
                    >
                      {play.price_change_pct > 0 ? '+' : ''}{play.price_change_pct.toFixed(2)}%
                    </span>
                  )}
                </div>
                {play.price_fetched_at && (
                  <div className="relative z-10 flex items-center gap-1.5 mt-1.5">
                    <div className="relative flex h-1.5 w-1.5">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        play.price_change_pct && play.price_change_pct >= 0 ? 'bg-[#00D4AA]' : 'bg-[#FF4D6A]'
                      }`}></span>
                      <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                        play.price_change_pct && play.price_change_pct >= 0 ? 'bg-[#00D4AA]' : 'bg-[#FF4D6A]'
                      }`}></span>
                    </div>
                    <span 
                      className="font-[family-name:var(--font-geist-mono)] text-[9px] text-[#8B95A8] uppercase tracking-widest cursor-help"
                      title={`Fetched at ${formatLocalTime(play.price_fetched_at)}`}
                    >
                      {formatRelativeTime(play.price_fetched_at)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 mt-2">
              <span
                className={`
                  text-[9px] font-black px-2 py-0.5 rounded-md tracking-wider uppercase font-[family-name:var(--font-geist-mono)]
                  ${isBuy
                    ? (isStrong ? 'bg-[#00FFD0]/10 border border-[#00FFD0]/30 text-[#00FFD0]' : 'bg-[#00D4AA]/10 border border-[#00D4AA]/20 text-[#00D4AA]')
                    : (isStrong ? 'bg-[#FF1744]/10 border border-[#FF1744]/30 text-[#FF1744]' : 'bg-[#FF4D6A]/10 border border-[#FF4D6A]/20 text-[#FF4D6A]')
                  }
                `}
              >
                {play.action_label}
              </span>
              {play.avg_target_price !== null && (
                <span className="text-[10px] font-[family-name:var(--font-geist-mono)] text-[#94A3B8]">
                  Target: <span className="text-[#F1F5F9] font-bold">${play.avg_target_price}</span>
                </span>
              )}
            </div>
          </div>

          {/* Reactor with active highlight animation */}
          <div className={`transition-all duration-300 ${activeSortBy === 'aura_score' ? `scale-110 filter drop-shadow-[0_0_12px_${isBuy ? 'rgba(0,212,170,0.5)' : 'rgba(255,77,106,0.5)'}]` : ''}`}>
            <AuraReactor score={play.aura_score} direction={play.direction} />
          </div>
        </div>

        {/* Micro-metrics row (Context-Aware Highlighting in Ghost aesthetic) */}
        <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-[#060A13]/10 border border-white/5 rounded-xl mb-4 font-[family-name:var(--font-geist-mono)] text-center">
          {/* Conviction */}
          <div className={`p-1.5 rounded-lg transition-all duration-300 flex flex-col justify-between h-[48px] ${activeSortBy === 'conviction'
            ? 'bg-white/[0.04] border border-white/10 shadow-[0_0_8px_rgba(255,255,255,0.02)] scale-[1.03]'
            : 'opacity-60 hover:opacity-80'
            }`}>
            <span className="block text-[7.5px] uppercase tracking-wider text-[#64748B] font-bold">Conviction</span>
            <span className="text-[10px] font-black text-[#F1F5F9] mt-0.5">{play.avg_conviction.toFixed(1)}/10</span>
            <div className="w-full bg-white/10 h-0.5 rounded-full mt-1 overflow-hidden">
              <div className={`h-full rounded-full ${isBuy ? 'bg-[#00D4AA]' : 'bg-[#FF4D6A]'}`} style={{ width: `${play.avg_conviction * 10}%` }} />
            </div>
          </div>

          {/* Buzz */}
          <div className={`p-1.5 rounded-lg transition-all duration-300 flex flex-col justify-between h-[48px] ${activeSortBy === 'mentions'
            ? 'bg-white/[0.04] border border-white/10 shadow-[0_0_8px_rgba(255,255,255,0.02)] scale-[1.03]'
            : 'opacity-60 hover:opacity-80'
            }`}>
            <span className="block text-[7.5px] uppercase tracking-wider text-[#64748B] font-bold">Buzz</span>
            <span className="text-[10px] font-black text-[#F1F5F9] mt-0.5">{play.recent_mentions}x</span>
            <div className="flex gap-0.5 mt-1 justify-center">
              {[...Array(Math.min(5, play.recent_mentions))].map((_, i) => (
                <span key={i} className={`w-0.5 h-0.5 rounded-full ${isBuy ? 'bg-[#00D4AA]' : 'bg-[#FF4D6A]'}`} />
              ))}
            </div>
          </div>

          {/* Agreement */}
          <div className={`p-1.5 rounded-lg transition-all duration-300 flex flex-col justify-between h-[48px] ${activeSortBy === 'consensus_sentiment'
            ? 'bg-white/[0.04] border border-white/10 shadow-[0_0_8px_rgba(255,255,255,0.02)] scale-[1.03]'
            : 'opacity-60 hover:opacity-80'
            }`}>
            <span className="block text-[7.5px] uppercase tracking-wider text-[#64748B] font-bold">Agreement</span>
            <span className="text-[10px] font-black text-[#F1F5F9] mt-0.5">{play.agreement_pct}%</span>
            <div className="w-full bg-white/10 h-0.5 rounded-full mt-1 overflow-hidden">
              <div className={`h-full rounded-full ${isBuy ? 'bg-[#00D4AA]' : 'bg-[#FF4D6A]'}`} style={{ width: `${play.agreement_pct}%` }} />
            </div>
          </div>
        </div>

        {/* Catalyst Quote - Editorial Pull-Quote Block */}
        <div className={`relative pl-4 border-l-2 ${isBuy ? 'border-[#00D4AA]/30' : 'border-[#FF4D6A]/30'} py-1 my-4`}>
          <span className={`absolute left-0 -top-3 text-3xl font-serif select-none pointer-events-none ${isBuy ? 'text-[#00D4AA]/10' : 'text-[#FF4D6A]/10'}`}>
            “
          </span>
          <p className="text-xs md:text-[13px] text-[#E2E8F0] italic font-serif leading-relaxed line-clamp-3">
            {play.top_catalyst}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-[9px] font-[family-name:var(--font-geist-mono)] tracking-wider text-[#94A3B8] font-bold">
            <span className="text-[#64748B]">—</span>
            <Link
              href={`/video?id=${catalystVideoId}`}
              onClick={(e) => e.stopPropagation()}
              className={`hover:underline ${isBuy ? 'hover:text-[#00D4AA]' : 'hover:text-[#FF4D6A]'} transition-colors`}
            >
              {catalystAuthor}
            </Link>
            <span className="text-[#475569]">•</span>
            <span>Conviction {catalystConviction}/10</span>
          </div>
        </div>
      </div>

      <div>
        {/* Source info */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5 text-[10px] text-[#94A3B8] font-[family-name:var(--font-geist-mono)]">
          <span className="truncate max-w-[130px]">
            Latest: <span className="text-[#E2E8F0] font-bold">{play.latest_video.channel_name}</span>
          </span>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/video?id=${play.latest_video.youtube_video_id}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[#94A3B8] hover:text-[#00D4AA] transition-colors"
              title="View video details"
            >
              <span>Intel</span>
              <Activity className="w-2.5 h-2.5" />
            </Link>
            <span className="text-[#374151]">•</span>
            <a
              href={`https://youtube.com/watch?v=${play.latest_video.youtube_video_id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[#94A3B8] hover:text-red-400 transition-colors"
              title="Watch on YouTube"
            >
              <span>YouTube</span>
              <YoutubeIcon className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>
      </div>
    </HolographicCard>
  )
}

// --- PulseStream (Tinder/TikTok full screen deck) ---

function PulseStream({
  plays,
  sortBy,
  index,
  setIndex
}: {
  plays: Play[]
  sortBy: SortOption
  index: number
  setIndex: (idx: number) => void
}) {
  const router = useRouter()
  const [direction, setDirection] = useState<'left' | 'right'>('right')

  if (plays.length === 0) return null

  // Ensure index stays safely within plays bounds
  const activeIndex = index >= plays.length ? 0 : index
  const play = plays[activeIndex]
  const isBuy = play.direction === 'BUY'
  const isStrong = play.aura_score >= 80

  const handleNext = () => {
    if (activeIndex < plays.length - 1) {
      setDirection('right')
      setIndex(activeIndex + 1)
    }
  }

  const handlePrev = () => {
    if (activeIndex > 0) {
      setDirection('left')
      setIndex(activeIndex - 1)
    }
  }

  // SNAPPY physics variants
  const slideVariants = {
    enter: (dir: 'left' | 'right') => ({
      x: dir === 'right' ? 220 : -220,
      opacity: 0,
      scale: 0.96
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: 'spring' as const, stiffness: 220, damping: 22 },
        opacity: { duration: 0.18 },
        scale: { duration: 0.18 }
      }
    },
    exit: (dir: 'left' | 'right') => ({
      x: dir === 'right' ? -220 : 220,
      opacity: 0,
      scale: 0.96,
      transition: {
        x: { type: 'spring' as const, stiffness: 220, damping: 22 },
        opacity: { duration: 0.12 },
        scale: { duration: 0.12 }
      }
    })
  }

  // Find channel and details matching the top catalyst
  const catalystMatch = play.catalysts?.find(c => c.notes === play.top_catalyst)
  const catalystAuthor = catalystMatch
    ? catalystMatch.channel_name
    : (play.catalysts?.[0]?.channel_name || play.latest_video.channel_name)
  const catalystConviction = catalystMatch
    ? catalystMatch.conviction
    : (play.catalysts?.[0]?.conviction || play.avg_conviction)
  const catalystVideoId = catalystMatch
    ? catalystMatch.youtube_video_id
    : (play.catalysts?.[0]?.youtube_video_id || play.latest_video.youtube_video_id)

  return (
    <div id="pulse-stream-container" className="w-full max-w-2xl mx-auto flex flex-col items-center px-2 animate-fade-up">
      {/* Top micro stats */}
      <div className="flex items-center justify-between w-full mb-3 px-2 text-xs font-[family-name:var(--font-geist-mono)] text-[#64748B]">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isBuy ? 'bg-[#00D4AA]' : 'bg-[#FF4D6A]'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isBuy ? 'bg-[#00D4AA]' : 'bg-[#FF4D6A]'}`}></span>
          </span>
          <span>Signal {activeIndex + 1} of {plays.length}</span>
        </div>
        <div className="flex gap-2">
          <span className="uppercase text-[9px] border border-white/5 px-1.5 py-0.5 rounded tracking-widest text-[#94A3B8]">
            {sortLabel[sortBy]}
          </span>
        </div>
      </div>

      {/* Focused Deck Container */}
      <div className="relative w-full h-[460px] md:h-[430px]">
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={play.ticker}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0 w-full h-full"
          >
            <HolographicCard
              direction={play.direction}
              isStrong={isStrong}
              className="w-full h-full p-6 md:p-8 flex flex-col justify-between border-2"
              onClick={() => router.push(`/ticker?s=${play.ticker}`)}
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <span className="text-[10px] tracking-widest font-black uppercase text-[#64748B] font-[family-name:var(--font-geist-mono)] block mb-1">
                      Signal Node
                    </span>
                    <h2 className="text-3xl md:text-5xl font-black text-[#F1F5F9] font-[family-name:var(--font-geist-mono)] tracking-wider">
                      <TextScramble text={play.ticker} duration={600} />
                    </h2>
                    
                    {play.current_price != null && (
                      <div className="relative group/price flex flex-col mt-3 bg-[#0A0F1A]/80 backdrop-blur-xl border border-white/5 rounded-xl p-3 w-max overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.3)]">
                        {/* Ambient background glow based on sentiment */}
                        {play.price_change_pct != null && (
                          <div 
                            className={`absolute inset-0 opacity-20 group-hover/price:opacity-30 transition-opacity duration-500 blur-xl ${
                              play.price_change_pct >= 0 ? 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#00D4AA]/40 to-transparent' : 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#FF4D6A]/40 to-transparent'
                            }`}
                          />
                        )}
                        
                        <div className="relative z-10 flex items-end gap-3">
                          <span className="font-[family-name:var(--font-geist-mono)] text-3xl font-black text-[#F1F5F9] leading-none tracking-tighter drop-shadow-md">
                            ${play.current_price.toFixed(2)}
                          </span>
                          {play.price_change_pct != null && (
                            <span 
                              className={`flex items-center gap-1 font-[family-name:var(--font-geist-mono)] text-sm font-bold mb-0.5 px-2 py-0.5 rounded-md border backdrop-blur-md ${
                                play.price_change_pct >= 0 
                                  ? 'bg-[#00D4AA]/10 text-[#00FFD0] border-[#00D4AA]/20 shadow-[0_0_10px_rgba(0,212,170,0.1)]' 
                                  : 'bg-[#FF4D6A]/10 text-[#FF4D6A] border-[#FF4D6A]/20 shadow-[0_0_10px_rgba(255,77,106,0.1)]'
                              }`}
                              title="Change since market open"
                            >
                              {play.price_change_pct > 0 ? '+' : ''}{play.price_change_pct.toFixed(2)}%
                            </span>
                          )}
                        </div>
                        {play.price_fetched_at && (
                          <div className="relative z-10 flex items-center gap-1.5 mt-2">
                            <div className="relative flex h-1.5 w-1.5">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                play.price_change_pct && play.price_change_pct >= 0 ? 'bg-[#00D4AA]' : 'bg-[#FF4D6A]'
                              }`}></span>
                              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                                play.price_change_pct && play.price_change_pct >= 0 ? 'bg-[#00D4AA]' : 'bg-[#FF4D6A]'
                              }`}></span>
                            </div>
                            <span 
                              className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[#8B95A8] uppercase tracking-widest cursor-help"
                              title={`Fetched at ${formatLocalTime(play.price_fetched_at)}`}
                            >
                              {formatRelativeTime(play.price_fetched_at)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <p className="text-xs text-[#CBD5E1] mt-1 font-semibold">{play.stock_name}</p>
                  </div>
                  <div className="scale-125 mr-2">
                    <AuraReactor score={play.aura_score} direction={play.direction} />
                  </div>
                </div>

                {/* Dashboard Stats */}
                <div className="grid grid-cols-3 gap-3 p-2 bg-[#060A13]/10 border border-white/5 rounded-xl mb-6 font-[family-name:var(--font-geist-mono)] text-center">
                  <div className={`p-1.5 rounded-lg transition-all duration-300 ${sortBy === 'conviction'
                    ? 'bg-white/[0.04] border border-white/10 shadow-[0_0_10px_rgba(255,255,255,0.02)] scale-105'
                    : 'opacity-70'
                    }`}>
                    <span className="block text-[8px] uppercase tracking-wider text-[#94A3B8] font-bold">Conviction</span>
                    <span className="text-xs font-black text-[#F1F5F9] mt-1 block">
                      {play.avg_conviction.toFixed(1)}/10
                    </span>
                  </div>
                  <div className={`p-1.5 rounded-lg transition-all duration-300 ${sortBy === 'mentions'
                    ? 'bg-white/[0.04] border border-white/10 shadow-[0_0_10px_rgba(255,255,255,0.02)] scale-105'
                    : 'opacity-70'
                    }`}>
                    <span className="block text-[8px] uppercase tracking-wider text-[#94A3B8] font-bold">Buzz</span>
                    <span className="text-xs font-black text-[#F1F5F9] mt-1 block">
                      {play.recent_mentions}x
                    </span>
                  </div>
                  <div className={`p-1.5 rounded-lg transition-all duration-300 ${sortBy === 'consensus_sentiment'
                    ? 'bg-white/[0.04] border border-white/10 shadow-[0_0_10px_rgba(255,255,255,0.02)] scale-105'
                    : 'opacity-70'
                    }`}>
                    <span className="block text-[8px] uppercase tracking-wider text-[#94A3B8] font-bold">Agreement</span>
                    <span className="text-xs font-black text-[#F1F5F9] mt-1 block">
                      {play.agreement_pct}%
                    </span>
                  </div>
                </div>

                {/* Catalyst Quote - Editorial Pull-Quote Block */}
                <div className={`relative pl-4 border-l-2 ${isBuy ? 'border-[#00D4AA]/30' : 'border-[#FF4D6A]/30'} py-2 my-4`}>
                  <span className={`absolute left-0 -top-3.5 text-4xl font-serif select-none pointer-events-none ${isBuy ? 'text-[#00D4AA]/10' : 'text-[#FF4D6A]/10'}`}>
                    “
                  </span>
                  <p className="text-sm md:text-base text-[#E2E8F0] italic font-serif leading-relaxed line-clamp-4">
                    {play.top_catalyst}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2.5 text-[10px] font-[family-name:var(--font-geist-mono)] tracking-wider text-[#94A3B8] font-bold">
                    <span className="text-[#64748B]">—</span>
                    <Link
                      href={`/video?id=${catalystVideoId}`}
                      onClick={(e) => e.stopPropagation()}
                      className={`hover:underline ${isBuy ? 'hover:text-[#00D4AA]' : 'hover:text-[#FF4D6A]'} transition-colors`}
                    >
                      {catalystAuthor}
                    </Link>
                    <span className="text-[#475569]">•</span>
                    <span>Conviction {catalystConviction}/10</span>
                  </div>
                </div>
              </div>

              <div>
                {/* Links */}
                <div className="flex items-center justify-between text-xs font-[family-name:var(--font-geist-mono)] text-[#94A3B8] border-t border-white/5 pt-4">
                  <Link
                    href={`/video?id=${play.latest_video.youtube_video_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 hover:text-[#00D4AA] transition-colors"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>View Analysis</span>
                  </Link>

                  <a
                    href={`https://youtube.com/watch?v=${play.latest_video.youtube_video_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 hover:text-red-400 transition-colors"
                  >
                    <YoutubeIcon className="w-3.5 h-3.5" />
                    <span>YouTube</span>
                  </a>
                </div>
              </div>
            </HolographicCard>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Stream Deck controls — hidden on mobile where dock provides navigation */}
      <div className="hidden md:flex items-center justify-center gap-8 mt-5 w-full">
        <button
          onClick={handlePrev}
          disabled={activeIndex === 0}
          className={`flex items-center justify-center p-3 rounded-full border bg-[#141B2D]/40 backdrop-blur-md transition-all duration-200 ${activeIndex === 0
            ? 'opacity-30 border-[#1E293B] text-[#475569] cursor-not-allowed'
            : 'border-[#1E293B] text-[#F1F5F9] hover:border-[#00D4AA] hover:text-[#00D4AA] active:scale-95'
            }`}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <span className="text-xs font-[family-name:var(--font-geist-mono)] text-[#94A3B8]">
          Signal {activeIndex + 1} of {plays.length}
        </span>

        <button
          onClick={handleNext}
          disabled={activeIndex === plays.length - 1}
          className={`flex items-center justify-center p-3 rounded-full border bg-[#141B2D]/40 backdrop-blur-md transition-all duration-200 ${activeIndex === plays.length - 1
            ? 'opacity-30 border-[#1E293B] text-[#475569] cursor-not-allowed'
            : 'border-[#1E293B] text-[#F1F5F9] hover:border-[#00D4AA] hover:text-[#00D4AA] active:scale-95'
            }`}
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

// --- Skeleton Loaders ---

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

type SortOption = 'aura_score' | 'mentions' | 'conviction' | 'consensus_sentiment'

const sortLabel: Record<SortOption, string> = {
  aura_score: 'Aura',
  mentions: 'Buzz',
  conviction: 'Conviction',
  consensus_sentiment: 'Sentiment',
}

export default function TodayPlaysPage() {
  const [data, setData] = useState<TodayPlaysData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('aura_score')
  const [activeTab, setActiveTab] = useState<'BUY' | 'SELL'>('BUY')
  const [viewMode, setViewMode] = useState<'grid' | 'stream'>('grid')
  const [streamIndex, setStreamIndex] = useState(0)
  const [sessionRestored, setSessionRestored] = useState(false)
  const headerRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = headerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
    el.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
  }

  // Restore user session tab preferences & handle mobile responsiveness
  useEffect(() => {
    let savedViewMode = sessionStorage.getItem('today_viewMode') as 'grid' | 'stream' | null

    // Check if this is a hard refresh to clear session data (if that's the intended behavior)
    let isReload = false
    if (typeof window !== 'undefined' && window.performance) {
      const navs = window.performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
      if (navs && navs.length > 0) {
        isReload = navs[0].type === 'reload'
      }
    }

    if (isReload) {
      sessionStorage.removeItem('today_sortBy')
      sessionStorage.removeItem('today_activeTab')
      sessionStorage.removeItem('today_viewMode')
      sessionStorage.removeItem('today_streamIndex')
      savedViewMode = null
    }

    if (savedViewMode) {
      setViewMode(savedViewMode)
    } else {
      // Default behavior when no preference is saved
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setViewMode('stream')
        sessionStorage.setItem('today_viewMode', 'stream')
      } else {
        setViewMode('grid')
        sessionStorage.setItem('today_viewMode', 'grid')
      }
    }

    // Restore other saved settings
    const savedSortBy = sessionStorage.getItem('today_sortBy') as SortOption
    const savedActiveTab = sessionStorage.getItem('today_activeTab') as 'BUY' | 'SELL'
    const savedStreamIndex = sessionStorage.getItem('today_streamIndex')

    if (savedSortBy) setSortBy(savedSortBy)
    if (savedActiveTab) setActiveTab(savedActiveTab)
    if (savedStreamIndex) {
      const parsed = parseInt(savedStreamIndex, 10)
      if (!isNaN(parsed)) setStreamIndex(parsed)
    }

    setSessionRestored(true)
  }, [])


  // Sync state changes back to sessionStorage
  useEffect(() => {
    if (!sessionRestored) return
    sessionStorage.setItem('today_sortBy', sortBy)
  }, [sortBy, sessionRestored])

  useEffect(() => {
    if (!sessionRestored) return
    sessionStorage.setItem('today_activeTab', activeTab)
  }, [activeTab, sessionRestored])

  useEffect(() => {
    if (!sessionRestored) return
    sessionStorage.setItem('today_viewMode', viewMode)
  }, [viewMode, sessionRestored])

  useEffect(() => {
    if (!sessionRestored) return
    sessionStorage.setItem('today_streamIndex', streamIndex.toString())
  }, [streamIndex, sessionRestored])

  useEffect(() => {
    if (!sessionRestored) return

    let active = true

    async function fetchPlays() {
      const cacheKey = `aura_today_plays_${sortBy}`
      let hasCache = false
      let localEtag: string | null = null

      try {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed && parsed.plays) {
            if (active) {
              setData(parsed)
              setLoading(false)
              hasCache = true
              if (parsed.generated_at) {
                localEtag = parsed.generated_at
              }
            }
          }
        }
      } catch (e) {
        console.warn('Failed to read from cache:', e)
      }

      if (!hasCache) {
        if (active) {
          setData(null)
          setLoading(true)
        }
      }

      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

        const headers: HeadersInit = {}
        if (localEtag) {
          headers['If-None-Match'] = `W/"${localEtag}"`
        }

        const res = await fetch(`${backendUrl}/api/v1/today?strategy=${sortBy}`, { headers })

        if (res.status === 304) {
          return // Cache is perfectly fresh, no need to parse or update
        }

        if (!res.ok) {
          throw new Error(`Server status ${res.status}`)
        }

        const json = await res.json()

        if (active) {
          setData(json)
          setError(null)

          try {
            localStorage.setItem(cacheKey, JSON.stringify(json))
          } catch (e) {
            console.warn('Failed to save cache:', e)
          }
        }
      } catch (err: any) {
        if (active) {
          logger.error('Failed to fetch plays:', err)
          if (!hasCache) {
            setError(err.message || 'Unable to connect to the backend server.')
          }
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    fetchPlays()

    return () => {
      active = false
    }
  }, [sortBy, sessionRestored])

  const sortPlays = (playsList: Play[]) => {
    return [...playsList].sort((a, b) => {
      if (sortBy === 'aura_score') {
        return b.aura_score - a.aura_score
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

  const buyPlays = data ? sortPlays(data.plays.filter((p) => p.direction === 'BUY')) : []
  const sellPlays = data ? sortPlays(data.plays.filter((p) => p.direction === 'SELL')) : []
  const activePlays = activeTab === 'BUY' ? buyPlays : sellPlays

  const isBuyTab = activeTab === 'BUY'
  const isAuraScore = sortBy === 'aura_score'

  // Colors & styles variables
  const activeColorText = isBuyTab ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'
  const activeColorBg = isBuyTab ? 'bg-[#00D4AA]' : 'bg-[#FF4D6A]'
  const activeColorBgOpacity = isBuyTab ? 'bg-[#00D4AA]/10' : 'bg-[#FF4D6A]/10'
  const activeRing = isBuyTab ? 'ring-[#00D4AA]/30' : 'ring-[#FF4D6A]/30'
  const activeShadow = isBuyTab ? 'shadow-[0_0_15px_rgba(0,212,170,0.1)]' : 'shadow-[0_0_15px_rgba(255,77,106,0.1)]'
  const activeGradient = isBuyTab ? 'from-[#00D4AA]/0 via-[#00D4AA]/5 to-[#00D4AA]/0' : 'from-[#FF4D6A]/0 via-[#FF4D6A]/5 to-[#FF4D6A]/0'

  const moodConfig = useMemo(() => {
    if (!data) return null
    const buyCount = data.market_mood.buy_plays
    const sellCount = data.market_mood.sell_plays
    const total = buyCount + sellCount

    if (total === 0) {
      return {
        color: 'text-[#8B95A8]',
        glow: 'from-[#8B95A8]/10 to-[#141B2D]/5',
        title: 'Neutral State',
        byline: 'Analyst signals are flat today.',
        scoreText: '0 signals',
      }
    }

    const buyRatio = buyCount / total
    const scoreText = `${Math.round(buyRatio * 100)}% Bullish Bias`

    if (buyRatio >= 0.8) {
      return {
        color: 'text-[#00D4AA] drop-shadow-[0_0_10px_rgba(0,212,170,0.3)]',
        glow: 'from-[#00D4AA]/20 to-[#00FFD0]/5',
        title: 'Extreme Bullish',
        byline: "Unwavering upside consensus. Analyst pipelines are loaded with green indicators.",
        scoreText,
      }
    } else if (buyRatio > 0.55) {
      return {
        color: 'text-[#00D4AA]',
        glow: 'from-[#00D4AA]/15 to-[#00D4AA]/5',
        title: 'Bullish Momentum',
        byline: "Clear buy bias. Market sentiment leans towards growth indicators today.",
        scoreText,
      }
    } else if (buyRatio <= 0.2) {
      return {
        color: 'text-[#FF4D6A] drop-shadow-[0_0_10px_rgba(255,77,106,0.3)]',
        glow: 'from-[#FF4D6A]/20 to-[#FF1744]/5',
        title: 'Extreme Bearish',
        byline: "Severe downside conviction. Defensive hedging is highly recommended.",
        scoreText,
      }
    } else if (buyRatio < 0.45) {
      return {
        color: 'text-[#FF4D6A]',
        glow: 'from-[#FF4D6A]/15 to-[#FF4D6A]/5',
        title: 'Bearish Bias',
        byline: "Under pressure. Sellers outpace buyers in latest transcripts.",
        scoreText,
      }
    } else {
      return {
        color: 'text-[#8B95A8]',
        glow: 'from-[#8B95A8]/10 to-[#141B2D]/5',
        title: 'Mixed Signals',
        byline: "Tug-of-war. Bulls and Bears are divided on short term direction.",
        scoreText,
      }
    }
  }, [data])

  return (
    <main className="flex-1 w-full mx-auto relative min-h-screen pb-20 md:pb-8">
      {/* Premium SVG Noise Texture Overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.015] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 250 250' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />

      {/* 🚀 SCI-FI INTERACTIVE AURA GRADIENT BACKGROUND 🚀 */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden mix-blend-screen opacity-80 transition-all duration-1000">
        <div
          className="absolute inset-[-100%] animate-[spin_120s_linear_infinite]"
          style={{
            backgroundImage: `linear-gradient(${isBuyTab ? 'rgba(0,212,170,0.04)' : 'rgba(255,77,106,0.04)'} 1px, transparent 1px), linear-gradient(90deg, ${isBuyTab ? 'rgba(0,212,170,0.04)' : 'rgba(255,77,106,0.04)'} 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            backgroundPosition: 'center center',
          }}
        />
        <div className={`absolute -top-[20%] left-1/2 -translate-x-1/2 w-[120vw] h-[800px] bg-[radial-gradient(ellipse_at_top,${isBuyTab ? 'rgba(0,212,170,0.12)' : 'rgba(255,77,106,0.12)'}_0%,transparent_70%)] animate-pulse`} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(10,15,26,0.92)_100%)]" />
      </div>

      <div className="w-full max-w-6xl mx-auto px-4 md:px-8 py-8 relative z-10">

        {/* Unified Dashboard Header */}
        <section 
          ref={headerRef}
          className="mb-10 relative overflow-hidden rounded-3xl border border-[#1E293B] bg-[#141B2D]/45 backdrop-blur-md shadow-xl shadow-black/30 group"
          onMouseMove={handleMouseMove}
        >
          {/* Mouse Tracking Glow */}
          <div 
            className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-300 opacity-0 group-hover:opacity-100"
            style={{
              background: `radial-gradient(600px circle at var(--mouse-x, 0px) var(--mouse-y, 0px), rgba(255,255,255,0.04), transparent 40%)`
            }}
          />
          
          {/* Primary: Living EKG Verdict Header (Market Pulse) */}
          <div className="relative p-6 md:px-10 md:py-8 z-10">
            {data && (
              <>
                <div className={`absolute top-0 right-1/4 w-[300px] h-[300px] rounded-full blur-[110px] pointer-events-none bg-gradient-to-br ${moodConfig?.glow} opacity-60 transition-all duration-1000`} />
                <PulseField overallMood={data.market_mood.overall} direction={activeTab} />
              </>
            )}

            <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Activity className={`w-3.5 h-3.5 ${activeColorText} animate-pulse`} />
                  <h1 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#64748B] font-[family-name:var(--font-geist-mono)]">
                    Market Pulse
                  </h1>
                </div>

                {loading ? (
                  <div className="space-y-2 mt-3">
                    <div className="h-8 w-52 bg-[#1E293B] rounded animate-pulse" />
                    <div className="h-2.5 w-80 bg-[#1E293B]/60 rounded animate-pulse" />
                  </div>
                ) : error ? (
                  <div className="mt-3">
                    <h2 className="text-lg font-bold text-[#FF4D6A] flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Off-grid Node
                    </h2>
                    <p className="text-xs text-[#64748B] mt-1">
                      Failed to synchronise with feed data. {error}
                    </p>
                  </div>
                ) : (
                  <div className="mt-2.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-4xl md:text-6xl font-black tracking-tighter ${moodConfig?.color} transition-all duration-1000 leading-none`}>
                        {moodConfig?.title}
                      </span>
                      <span className="text-xs md:text-sm text-[#64748B] font-bold font-[family-name:var(--font-geist-mono)] bg-[#0A0F1A]/80 border border-[#1E293B] px-3 py-1.5 md:px-4 md:py-2 rounded-xl">
                        {moodConfig?.scoreText}
                      </span>
                    </div>
                    <p className="text-sm text-[#8B95A8] mt-3 max-w-xl leading-relaxed">
                      {moodConfig?.byline}
                    </p>
                  </div>
                )}
              </div>

              {/* Quick Metrics Bar -> Tug-of-War Polarity Gauge */}
              {!loading && !error && data && (
                <div className="flex flex-col justify-center rounded-2xl border border-[#1E293B] bg-[#0A0F1A]/80 p-5 shrink-0 self-start xl:self-auto font-[family-name:var(--font-geist-mono)] shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] w-full xl:w-[380px]">
                  <div className="flex items-end justify-between mb-3">
                    <div className="flex flex-col">
                      <span className="text-2xl md:text-3xl font-black text-[#00D4AA] leading-none">{buyPlays.length}</span>
                      <span className="text-[9px] md:text-[10px] uppercase tracking-widest text-[#64748B] mt-1 font-bold">Buy Nodes</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-2xl md:text-3xl font-black text-[#FF4D6A] leading-none">{sellPlays.length}</span>
                      <span className="text-[9px] md:text-[10px] uppercase tracking-widest text-[#64748B] mt-1 font-bold">Sell Nodes</span>
                    </div>
                  </div>
                  
                  {/* The Gauge */}
                  <div className="relative w-full h-2.5 bg-[#141B2D] rounded-full overflow-hidden flex border border-[#1E293B]/60">
                    <div 
                      className="h-full bg-[#00D4AA] shadow-[0_0_8px_#00D4AA] transition-all duration-1000 ease-out"
                      style={{ width: `${(buyPlays.length / Math.max(1, buyPlays.length + sellPlays.length)) * 100}%` }}
                    />
                    <div 
                      className="h-full bg-[#FF4D6A] shadow-[0_0_8px_#FF4D6A] transition-all duration-1000 ease-out"
                      style={{ width: `${(sellPlays.length / Math.max(1, buyPlays.length + sellPlays.length)) * 100}%` }}
                    />
                    {/* Center Mark */}
                    <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/20" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Secondary: Explainer Strip */}
          <div className="border-t border-[#1E293B]/60 bg-[#0A0F1A]/50 px-6 py-3.5 md:px-10">
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-[#475569] shrink-0" />
              <p className="text-xs text-[#64748B] leading-relaxed max-w-none font-sans">
                <span className="font-bold text-[#8B95A8] mr-1">30-Day Trailing Lookback.</span> 
                This feed aggregates and quantifies conviction signals from elite finance channels, filtering noise to surface actionable insights where analyst consensus is strongest.
              </p>
            </div>
          </div>
        </section>

        {/* HUD Sort Controls */}
        {!loading && !error && data && (data.plays.length > 0) && (
          <div className="hidden md:flex flex-col gap-3 mb-6">

            {/* Top Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-3 rounded-2xl border border-[#1E293B]/50 bg-[#0A0F1A]/50 backdrop-blur-md">

              {/* Layout Switchers */}
              <div className="flex items-center gap-2 bg-[#0A0F1A]/80 border border-[#1E293B] rounded-xl p-1 text-xs select-none">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all duration-300 flex items-center gap-1.5 ${viewMode === 'grid'
                    ? `bg-[#141B2D] ${activeColorText} ring-1 ${activeRing}`
                    : 'text-[#64748B] hover:text-[#F1F5F9]'
                    }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Grid</span>
                </button>
                <button
                  onClick={() => setViewMode('stream')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all duration-300 flex items-center gap-1.5 ${viewMode === 'stream'
                    ? `bg-[#141B2D] ${activeColorText} ring-1 ${activeRing}`
                    : 'text-[#64748B] hover:text-[#F1F5F9]'
                    }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Pulse Stream</span>
                </button>
              </div>

              {/* Sort selector */}
              <div className="flex flex-wrap items-center gap-1 bg-[#0A0F1A]/80 border border-[#1E293B] rounded-xl p-1 text-xs select-none">
                <span className="text-[#64748B] px-2 font-bold font-[family-name:var(--font-geist-mono)] text-[10px]">SORT STRATEGY:</span>
                {(
                  [
                    { key: 'aura_score', label: 'Aura' },
                    { key: 'mentions', label: 'Buzz' },
                    { key: 'conviction', label: 'Conviction' },
                    { key: 'consensus_sentiment', label: 'Sentiment' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => { setSortBy(opt.key); setStreamIndex(0); }}
                    className={`px-3 py-1 rounded-lg font-bold transition-all duration-300 relative overflow-hidden ${sortBy === opt.key
                      ? `bg-[#141B2D] ${activeColorText} ring-1 ${activeRing} ${activeShadow}`
                      : 'text-[#64748B] hover:text-[#F1F5F9] hover:bg-[#141B2D]/40'
                      }`}
                  >
                    {sortBy === opt.key && (
                      <div className={`absolute inset-0 bg-gradient-to-r ${activeGradient} pointer-events-none`} />
                    )}
                    <span className="relative z-10 font-[family-name:var(--font-geist-mono)]">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Explanation box */}
            <div className={`relative overflow-hidden rounded-xl border ${isAuraScore ? 'border-[#00D4AA]/40 shadow-[0_0_15px_rgba(0,212,170,0.05)]' : 'border-[#1E293B]/70'} bg-[#141B2D]/50 p-4 transition-all duration-500`}>
              <div className="relative flex items-center gap-3">
                <Sparkles className={`w-4 h-4 shrink-0 ${activeColorText}`} />
                <div className="text-xs text-[#8B95A8] leading-relaxed flex-1 flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                  <span className="font-bold text-[#F1F5F9] uppercase tracking-wider font-[family-name:var(--font-geist-mono)] text-[10px]">
                    {sortLabel[sortBy]}:
                  </span>
                  <span className="flex-1">
                    {sortBy === 'aura_score' && "Composite scoring balancing agreement, recency, and conviction parameters."}
                    {sortBy === 'mentions' && "Prioritized strictly by coverage volume and social buzz metrics."}
                    {sortBy === 'conviction' && "Focuses on absolute levels of certainty among elite market channels."}
                    {sortBy === 'consensus_sentiment' && "Pure polarity sorting, highlighting overall bullishness or bearishness."}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Strategy Explanation */}
        {!loading && !error && data && (data.plays.length > 0) && (
          <div className="md:hidden mb-4">
            <div className={`relative overflow-hidden rounded-xl border ${isAuraScore ? 'border-[#00D4AA]/20' : 'border-[#1E293B]/70'} bg-[#141B2D]/50 px-3.5 py-3 transition-all duration-500`}>
              <div className="relative flex items-start gap-2.5">
                <Sparkles className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${activeColorText}`} />
                <div className="text-[11px] text-[#8B95A8] leading-relaxed">
                  <span className="font-bold text-[#F1F5F9] uppercase tracking-wider font-[family-name:var(--font-geist-mono)] text-[9px]">
                    {sortLabel[sortBy]}
                  </span>
                  <span className="mx-1.5 text-[#475569]">—</span>
                  <span>
                    {sortBy === 'aura_score' && "Composite score balancing agreement, recency & conviction."}
                    {sortBy === 'mentions' && "Ranked by coverage volume and social buzz."}
                    {sortBy === 'conviction' && "Sorted by analyst certainty levels."}
                    {sortBy === 'consensus_sentiment' && "Pure polarity — bullishness vs bearishness."}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        {loading ? (
          <div className="space-y-8 animate-fade-up">
            <div className="flex gap-4 border-b border-[#1E293B] pb-px">
              <div className="h-8 w-24 bg-[#1E293B] rounded-t-lg" />
              <div className="h-8 w-24 bg-[#1E293B] rounded-t-lg" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-16 border border-[#1E293B] bg-[#141B2D]/20 rounded-2xl relative overflow-hidden">
            <AlertTriangle className="w-12 h-12 mx-auto text-[#FF4D6A] mb-4 animate-bounce" />
            <h3 className="text-lg font-bold text-[#F1F5F9]">Failed to Sync Channels</h3>
            <p className="text-xs text-[#64748B] mt-2 max-w-xs mx-auto">
              Please check your database connectivity or API network route.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-4 py-2 text-xs font-bold rounded-lg bg-[#00D4AA]/10 hover:bg-[#00D4AA]/25 text-[#00D4AA] border border-[#00D4AA]/30 transition-all duration-200"
            >
              Re-initialize Link
            </button>
          </div>
        ) : buyPlays.length === 0 && sellPlays.length === 0 ? (
          <div className="text-center py-16 border border-[#1E293B] bg-[#141B2D]/15 rounded-3xl">
            <Activity className="w-12 h-12 mx-auto text-[#64748B] mb-4" />
            <h3 className="text-lg font-bold text-[#F1F5F9]">No Actionable Signals</h3>
            <p className="text-xs text-[#64748B] mt-2 max-w-xs mx-auto">
              No recommendations met the quality consensus criteria in the 30 day window.
            </p>
            <div className="flex justify-center gap-4 mt-6">
              <Link
                href="/"
                className="px-4 py-2 text-xs font-bold rounded-lg border border-[#1E293B] text-[#8B95A8] hover:text-[#F1F5F9] hover:bg-[#141B2D] transition-all"
              >
                Go to Explore
              </Link>
              <Link
                href="/admin/ingest"
                className="px-4 py-2 text-xs font-bold rounded-lg bg-[#00D4AA] text-[#0A0F1A] hover:opacity-90 transition-all"
              >
                Scan Channels
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">

            {/* Desktop Tabs Selectors */}
            <div className="hidden md:flex items-center gap-6 border-b border-[#1E293B]/60 pb-px select-none font-[family-name:var(--font-geist-mono)]">
              <button
                onClick={() => { setActiveTab('BUY'); setStreamIndex(0); }}
                className={`pb-4 px-2 text-sm font-black tracking-widest transition-all duration-300 relative ${activeTab === 'BUY' ? 'text-[#00D4AA]' : 'text-[#64748B] hover:text-[#8B95A8]'
                  }`}
              >
                BUY SIGNALS
                <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${activeTab === 'BUY' ? 'bg-[#00D4AA]/10 text-[#00D4AA] border border-[#00D4AA]/20' : 'bg-[#1E293B] text-[#8B95A8]'
                  }`}>
                  {buyPlays.length}
                </span>
                {activeTab === 'BUY' && (
                  <motion.div
                    layoutId="activeTabUnderline"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00D4AA] shadow-[0_0_8px_#00D4AA]"
                  />
                )}
              </button>
              <button
                onClick={() => { setActiveTab('SELL'); setStreamIndex(0); }}
                className={`pb-4 px-2 text-sm font-black tracking-widest transition-all duration-300 relative ${activeTab === 'SELL' ? 'text-[#FF4D6A]' : 'text-[#64748B] hover:text-[#8B95A8]'
                  }`}
              >
                SELL SIGNALS
                <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${activeTab === 'SELL' ? 'bg-[#FF4D6A]/10 text-[#FF4D6A] border border-[#FF4D6A]/20' : 'bg-[#1E293B] text-[#8B95A8]'
                  }`}>
                  {sellPlays.length}
                </span>
                {activeTab === 'SELL' && (
                  <motion.div
                    layoutId="activeTabUnderline"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF4D6A] shadow-[0_0_8px_#FF4D6A]"
                  />
                )}
              </button>
            </div>

            {/* Layout Renderers */}
            <div className="relative">
              {viewMode === 'grid' ? (
                /* Grid View */
                activePlays.length > 0 ? (
                  <motion.div
                    layout
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  >
                    <AnimatePresence mode="popLayout">
                      {activePlays.map((play, idx) => (
                        <motion.div
                          key={play.ticker}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{
                            type: 'spring',
                            stiffness: 300,
                            damping: 30
                          }}
                          className="h-full"
                        >
                          <PlayCard play={play} index={idx} activeSortBy={sortBy} />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#1E293B] bg-[#141B2D]/20 p-16 text-center animate-fade-in">
                    <Info className="w-8 h-8 text-[#64748B] mb-3 opacity-60" />
                    <div className="text-sm font-bold text-[#F1F5F9] mb-1">No Active {activeTab} Indicators</div>
                    <div className="text-xs text-[#8B95A8] max-w-xs leading-relaxed">Adjust your sort filter strategy to see other signal channels.</div>
                  </div>
                )
              ) : (
                /* Stream View (Focused Swipe Cards) */
                activePlays.length > 0 ? (
                  <PulseStream
                    plays={activePlays}
                    sortBy={sortBy}
                    index={streamIndex}
                    setIndex={setStreamIndex}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#1E293B] bg-[#141B2D]/20 p-16 text-center animate-fade-in">
                    <Info className="w-8 h-8 text-[#64748B] mb-3 opacity-60" />
                    <div className="text-sm font-bold text-[#F1F5F9] mb-1">No Active Stream</div>
                    <div className="text-xs text-[#8B95A8] max-w-xs leading-relaxed">No signals found under this classification node.</div>
                  </div>
                )
              )}
            </div>

          </div>
        )}
      </div>

      {/* 📱 MOBILE FLOATING DOCK 📱 */}
      {!loading && !error && data && (
        <div className="md:hidden fixed bottom-16 left-4 right-4 z-30 bg-[#0A0F1A]/90 backdrop-blur-xl border border-[#1E293B] shadow-2xl rounded-2xl overflow-hidden select-none">

          {/* Top row: Stream navigation — only visible in stream mode */}
          {viewMode === 'stream' && activePlays.length > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#1E293B]/60">
              <button
                onClick={() => { if (streamIndex > 0) setStreamIndex(streamIndex - 1) }}
                disabled={streamIndex === 0}
                className={`p-1.5 rounded-lg transition-all ${streamIndex === 0
                  ? 'opacity-20 text-[#475569]'
                  : `${activeColorText} active:scale-90`
                  }`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* Position dots / counter */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-[family-name:var(--font-geist-mono)] text-[#8B95A8] tabular-nums">
                  {streamIndex + 1} <span className="text-[#475569]">/</span> {activePlays.length}
                </span>
                <button
                  onClick={() => {
                    document.getElementById('pulse-stream-container')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all active:scale-95 ${isBuyTab ? 'text-[#00D4AA] bg-[#00D4AA]/10 border border-[#00D4AA]/20' : 'text-[#FF4D6A] bg-[#FF4D6A]/10 border border-[#FF4D6A]/20'}`}
                >
                  <Maximize className="w-3 h-3" />
                  <span className="text-[9px] font-bold uppercase tracking-wider font-[family-name:var(--font-geist-mono)]">Focus</span>
                </button>
              </div>

              <button
                onClick={() => { if (streamIndex < activePlays.length - 1) setStreamIndex(streamIndex + 1) }}
                disabled={streamIndex === activePlays.length - 1}
                className={`p-1.5 rounded-lg transition-all ${streamIndex === activePlays.length - 1
                  ? 'opacity-20 text-[#475569]'
                  : `${activeColorText} active:scale-90`
                  }`}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Bottom row: BUY/SELL + Sort */}
          <div className="flex items-center justify-between gap-2 px-2.5 py-2">
            {/* BUY/SELL Toggle */}
            <div className="flex items-center bg-[#0A0F1A] border border-[#1E293B] rounded-xl p-0.5 flex-1">
              <button
                onClick={() => { setActiveTab('BUY'); setStreamIndex(0); }}
                className={`w-1/2 py-2 text-[10px] font-black rounded-lg transition-all duration-200 tracking-wider font-[family-name:var(--font-geist-mono)] ${isBuyTab ? 'bg-[#00D4AA]/15 text-[#00D4AA]' : 'text-[#64748B]'
                  }`}
              >
                BUY ({buyPlays.length})
              </button>
              <button
                onClick={() => { setActiveTab('SELL'); setStreamIndex(0); }}
                className={`w-1/2 py-2 text-[10px] font-black rounded-lg transition-all duration-200 tracking-wider font-[family-name:var(--font-geist-mono)] ${!isBuyTab ? 'bg-[#FF4D6A]/15 text-[#FF4D6A]' : 'text-[#64748B]'
                  }`}
              >
                SELL ({sellPlays.length})
              </button>
            </div>

            {/* Sort Strategy Selector */}
            <div className="flex items-center gap-1">
              {/* Grid/Stream Toggle */}
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'stream' : 'grid')}
                className="p-2.5 rounded-xl bg-[#141B2D] border border-[#1E293B] text-[#F1F5F9] active:scale-95 transition-all"
                title="Toggle View Mode"
              >
                {viewMode === 'grid' ? <Layers className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
              </button>

              {/* Sort Selector */}
              <div className="relative text-[10px] font-black font-[family-name:var(--font-geist-mono)] px-3 py-2.5 rounded-xl bg-[#141B2D] border border-[#1E293B] text-[#F1F5F9] flex items-center gap-1.5 active:scale-95 transition-all">
                <Sparkles className={`w-3.5 h-3.5 ${isBuyTab ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'}`} />
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as SortOption)
                    setStreamIndex(0)
                  }}
                  className="bg-transparent text-[#F1F5F9] uppercase outline-none cursor-pointer appearance-none pr-4 font-bold"
                >
                  <option value="aura_score" className="bg-[#0A0F1A] text-[#F1F5F9]">Aura</option>
                  <option value="mentions" className="bg-[#0A0F1A] text-[#F1F5F9]">Buzz</option>
                  <option value="conviction" className="bg-[#0A0F1A] text-[#F1F5F9]">Conviction</option>
                  <option value="consensus_sentiment" className="bg-[#0A0F1A] text-[#F1F5F9]">Sentiment</option>
                </select>
                <span className="absolute right-2.5 pointer-events-none text-[7px] text-[#64748B]">▼</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}

const logger = {
  error: (msg: string, ...args: any[]) => {
    console.error(msg, ...args)
  }
}
