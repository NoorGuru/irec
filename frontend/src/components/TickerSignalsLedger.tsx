'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { formatRelativeTime } from '@/lib/utils'
import {
  Search,
  X,
  ArrowUpDown,
  LayoutGrid,
  Table,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  Play,
  Quote,
  Target,
  ShieldCheck,
  Filter,
} from 'lucide-react'

export interface SignalRecommendation {
  ticker: string
  stock_name: string
  sentiment: number
  target_price: number | null
  conviction_level: number
  catalyst_notes: string
  videos: {
    title?: string | null
    video_url: string
    youtube_video_id: string
    published_at: string
    channel_id: string
    channels: {
      channel_name: string
      trust_weight: number
    }
  }
}

interface TickerSignalsLedgerProps {
  recommendations: SignalRecommendation[]
  symbol: string
}

type FilterType = 'all' | 'bullish' | 'bearish' | 'target' | 'high_conviction'
type SortType = 'newest' | 'target_high' | 'target_low' | 'conviction_high' | 'trust_high'
type ViewMode = 'dossier' | 'ledger'

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function getSentimentLabel(sentiment: number): string {
  const labels: Record<number, string> = {
    [-2]: 'Strong Sell',
    [-1]: 'Sell',
    0: 'Neutral',
    1: 'Buy',
    2: 'Strong Buy',
  }
  return labels[sentiment] || 'Neutral'
}

function getSentimentBadgeClass(sentiment: number): string {
  if (sentiment >= 2) return 'sentiment-badge sentiment-badge-strong-buy'
  if (sentiment >= 1) return 'sentiment-badge sentiment-badge-buy'
  if (sentiment <= -2) return 'sentiment-badge sentiment-badge-strong-sell'
  if (sentiment <= -1) return 'sentiment-badge sentiment-badge-sell'
  return 'sentiment-badge sentiment-badge-neutral'
}

function SentimentArrow({ value }: { value: number }) {
  if (value >= 1) {
    return (
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="inline-block shrink-0">
        <path d="M7 2L7 12M7 2L3 6M7 2L11 6" stroke="#00FFD0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  if (value <= -1) {
    return (
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="inline-block shrink-0">
        <path d="M7 12L7 2M7 12L3 8M7 12L11 8" stroke="#FF1744" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  return null
}

function ConvictionDots({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-0.5" title={`Conviction: ${level}/10`}>
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-colors ${
            i < level ? 'bg-[#00D4AA]' : 'bg-[#1E293B]'
          }`}
        />
      ))}
    </div>
  )
}

export default function TickerSignalsLedger({ recommendations, symbol }: TickerSignalsLedgerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('dossier')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortType>('newest')
  const [visibleCount, setVisibleCount] = useState(6)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // Compute facet statistics
  const counts = useMemo(() => {
    return {
      all: recommendations.length,
      bullish: recommendations.filter((r) => r.sentiment >= 0.5).length,
      bearish: recommendations.filter((r) => r.sentiment <= -0.5).length,
      target: recommendations.filter((r) => r.target_price !== null && r.target_price > 0).length,
      highConviction: recommendations.filter((r) => r.conviction_level >= 8).length,
    }
  }, [recommendations])

  // Filter and Sort Pipeline
  const filteredAndSortedSignals = useMemo(() => {
    let result = [...recommendations]

    // 1. Facet Filter
    if (filterType === 'bullish') {
      result = result.filter((r) => r.sentiment >= 0.5)
    } else if (filterType === 'bearish') {
      result = result.filter((r) => r.sentiment <= -0.5)
    } else if (filterType === 'target') {
      result = result.filter((r) => r.target_price !== null && r.target_price > 0)
    } else if (filterType === 'high_conviction') {
      result = result.filter((r) => r.conviction_level >= 8)
    }

    // 2. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (r) =>
          r.videos.channels.channel_name.toLowerCase().includes(q) ||
          r.catalyst_notes?.toLowerCase().includes(q) ||
          r.videos.title?.toLowerCase().includes(q)
      )
    }

    // 3. Sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.videos.published_at).getTime() - new Date(a.videos.published_at).getTime()
      }
      if (sortBy === 'target_high') {
        return (b.target_price ?? -Infinity) - (a.target_price ?? -Infinity)
      }
      if (sortBy === 'target_low') {
        return (a.target_price ?? Infinity) - (b.target_price ?? Infinity)
      }
      if (sortBy === 'conviction_high') {
        return b.conviction_level - a.conviction_level
      }
      if (sortBy === 'trust_high') {
        const tA = a.videos.channels.trust_weight || 1.0
        const tB = b.videos.channels.trust_weight || 1.0
        return tB - tA
      }
      return 0
    })

    return result
  }, [recommendations, filterType, searchQuery, sortBy])

  // Slice visible signals for progressive disclosure
  const displayedSignals = useMemo(() => {
    return filteredAndSortedSignals.slice(0, visibleCount)
  }, [filteredAndSortedSignals, visibleCount])

  const hasMore = visibleCount < filteredAndSortedSignals.length
  const stepSize = viewMode === 'dossier' ? 6 : 12

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + stepSize)
  }

  const handleShowAll = () => {
    setVisibleCount(filteredAndSortedSignals.length)
  }

  const handleCollapse = () => {
    setVisibleCount(viewMode === 'dossier' ? 6 : 12)
    // Smooth scroll back to signals header
    const el = document.getElementById('analyst-signals-container')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const toggleRowExpand = (id: string) => {
    setExpandedRow((prev) => (prev === id ? null : id))
  }

  return (
    <div id="analyst-signals-container" className="space-y-6 pt-6 border-t border-white/5">
      {/* Header & View Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF4D6A]/20 to-[#FF4D6A]/5 border border-[#FF4D6A]/20 shadow-inner">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FF4D6A"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path>
              <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="#FF4D6A"></polygon>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-[family-name:var(--font-geist-mono)] font-bold text-[#F1F5F9]">
                Analyst Signals
              </h2>
              <span className="text-xs font-[family-name:var(--font-geist-mono)] px-2 py-0.5 rounded-full bg-[#141B2D] border border-[#1E293B] text-[#00D4AA]">
                {filteredAndSortedSignals.length} {filteredAndSortedSignals.length === 1 ? 'Signal' : 'Signals'}
              </span>
            </div>
            <p className="text-xs text-[#8B95A8]">
              Deep dive coverage and thesis breakdowns for ${symbol}
            </p>
          </div>
        </div>

        {/* View Mode Toggle: Dossier vs Terminal Ledger */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="flex items-center p-1 rounded-xl bg-[#0A0F1A] border border-[#1E293B] shadow-inner font-[family-name:var(--font-geist-mono)] text-xs">
            <button
              onClick={() => {
                setViewMode('dossier')
                setVisibleCount(6)
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === 'dossier'
                  ? 'bg-[#141B2D] text-[#00D4AA] shadow-sm border border-white/5'
                  : 'text-[#8B95A8] hover:text-[#F1F5F9]'
              }`}
            >
              <LayoutGrid size={14} />
              <span>Dossiers</span>
            </button>
            <button
              onClick={() => {
                setViewMode('ledger')
                setVisibleCount(12)
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === 'ledger'
                  ? 'bg-[#141B2D] text-[#00D4AA] shadow-sm border border-white/5'
                  : 'text-[#8B95A8] hover:text-[#F1F5F9]'
              }`}
            >
              <Table size={14} />
              <span>Terminal Ledger</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Controls Strip: Filter Chips + Search + Sort */}
      <div className="p-4 rounded-2xl bg-[#141B2D]/60 border border-white/5 backdrop-blur-xl space-y-3">
        {/* Row 1: Horizontal Scrollable Filter Chips */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full scrollbar-none font-[family-name:var(--font-geist-mono)] text-xs">
            <button
              onClick={() => {
                setFilterType('all')
                setVisibleCount(viewMode === 'dossier' ? 6 : 12)
              }}
              className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 flex items-center gap-1.5 ${
                filterType === 'all'
                  ? 'bg-[#00D4AA]/15 border-[#00D4AA]/40 text-[#00D4AA] font-bold'
                  : 'bg-[#0A0F1A] border-[#1E293B] text-[#8B95A8] hover:text-[#F1F5F9] hover:border-white/10'
              }`}
            >
              <span>All Signals</span>
              <span className="text-[10px] opacity-70 px-1.5 py-0.2 rounded-full bg-white/5">
                {counts.all}
              </span>
            </button>

            <button
              onClick={() => {
                setFilterType('bullish')
                setVisibleCount(viewMode === 'dossier' ? 6 : 12)
              }}
              className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 flex items-center gap-1.5 ${
                filterType === 'bullish'
                  ? 'bg-[#00D4AA]/20 border-[#00D4AA]/50 text-[#00FFD0] font-bold'
                  : 'bg-[#0A0F1A] border-[#1E293B] text-[#8B95A8] hover:text-[#00D4AA] hover:border-[#00D4AA]/30'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA]"></span>
              <span>Bullish</span>
              <span className="text-[10px] opacity-70 px-1.5 py-0.2 rounded-full bg-white/5">
                {counts.bullish}
              </span>
            </button>

            <button
              onClick={() => {
                setFilterType('bearish')
                setVisibleCount(viewMode === 'dossier' ? 6 : 12)
              }}
              className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 flex items-center gap-1.5 ${
                filterType === 'bearish'
                  ? 'bg-[#FF4D6A]/20 border-[#FF4D6A]/50 text-[#FF4D6A] font-bold'
                  : 'bg-[#0A0F1A] border-[#1E293B] text-[#8B95A8] hover:text-[#FF4D6A] hover:border-[#FF4D6A]/30'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF4D6A]"></span>
              <span>Bearish</span>
              <span className="text-[10px] opacity-70 px-1.5 py-0.2 rounded-full bg-white/5">
                {counts.bearish}
              </span>
            </button>

            <button
              onClick={() => {
                setFilterType('target')
                setVisibleCount(viewMode === 'dossier' ? 6 : 12)
              }}
              className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 flex items-center gap-1.5 ${
                filterType === 'target'
                  ? 'bg-[#00FFD0]/15 border-[#00FFD0]/40 text-[#00FFD0] font-bold'
                  : 'bg-[#0A0F1A] border-[#1E293B] text-[#8B95A8] hover:text-[#F1F5F9] hover:border-white/10'
              }`}
            >
              <Target size={12} className="text-[#00FFD0]" />
              <span>With Target</span>
              <span className="text-[10px] opacity-70 px-1.5 py-0.2 rounded-full bg-white/5">
                {counts.target}
              </span>
            </button>

            <button
              onClick={() => {
                setFilterType('high_conviction')
                setVisibleCount(viewMode === 'dossier' ? 6 : 12)
              }}
              className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 flex items-center gap-1.5 ${
                filterType === 'high_conviction'
                  ? 'bg-[#00D4AA]/15 border-[#00D4AA]/40 text-[#00D4AA] font-bold'
                  : 'bg-[#0A0F1A] border-[#1E293B] text-[#8B95A8] hover:text-[#F1F5F9] hover:border-white/10'
              }`}
            >
              <span>Conviction ≥ 8</span>
              <span className="text-[10px] opacity-70 px-1.5 py-0.2 rounded-full bg-white/5">
                {counts.highConviction}
              </span>
            </button>
          </div>
        </div>

        {/* Row 2: Search Input & Sort Selector */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-white/5">
          {/* In-Stream Keyword Search */}
          <div className="relative flex-1 max-w-md">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setVisibleCount(viewMode === 'dossier' ? 6 : 12)
              }}
              placeholder="Filter by analyst, catalyst keyword, or title..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#0A0F1A] border border-[#1E293B] text-xs text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-[#00D4AA]/50 focus:ring-1 focus:ring-[#00D4AA]/20 transition-all font-[family-name:var(--font-geist-mono)]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#F1F5F9] transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 shrink-0 font-[family-name:var(--font-geist-mono)] text-xs">
            <span className="text-[#64748B] hidden sm:inline flex items-center gap-1">
              <ArrowUpDown size={12} />
              Sort:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortType)}
              className="px-3 py-2 rounded-xl bg-[#0A0F1A] border border-[#1E293B] text-xs text-[#F1F5F9] focus:outline-none focus:border-[#00D4AA]/50 transition-all cursor-pointer"
            >
              <option value="newest">Latest First (Freshness)</option>
              <option value="target_high">Highest Price Target</option>
              <option value="target_low">Lowest Price Target</option>
              <option value="conviction_high">Highest Conviction (10/10)</option>
              <option value="trust_high">Channel Trust Weight</option>
            </select>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredAndSortedSignals.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-[#141B2D]/40 border border-white/5">
          <Filter className="w-8 h-8 text-[#64748B] mx-auto mb-3 opacity-50" />
          <h3 className="text-sm font-bold text-[#F1F5F9]">No analyst signals match your filters</h3>
          <p className="text-xs text-[#8B95A8] mt-1 max-w-sm mx-auto">
            Try adjusting your sentiment facet or clearing your search term to see more signals.
          </p>
          {(filterType !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setFilterType('all')
                setSearchQuery('')
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-[#00D4AA]/10 hover:bg-[#00D4AA]/20 text-[#00D4AA] border border-[#00D4AA]/30 text-xs font-bold font-[family-name:var(--font-geist-mono)] transition-all"
            >
              Reset All Filters
            </button>
          )}
        </div>
      )}

      {/* VIEW MODE 1: Editorial Dossier Cards */}
      {viewMode === 'dossier' && displayedSignals.length > 0 && (
        <div className="space-y-4">
          {displayedSignals.map((rec, index) => {
            const isRecBull = rec.sentiment >= 0.5
            const isRecBear = rec.sentiment <= -0.5
            const accentBorder = isRecBull
              ? 'border-l-4 border-l-[#00D4AA]'
              : isRecBear
              ? 'border-l-4 border-l-[#FF4D6A]'
              : 'border-l-4 border-l-[#8B95A8]'
            const trustWeight = rec.videos.channels.trust_weight || 1.0

            return (
              <div
                key={`${rec.videos.youtube_video_id}-${index}`}
                className={`
                  group rounded-2xl border border-white/5 bg-[#141B2D]/70 backdrop-blur-xl p-5 md:p-6
                  ${accentBorder} shadow-lg shadow-black/20 hover:shadow-2xl hover:border-white/10 hover:-translate-y-0.5
                  transition-all duration-300
                `}
              >
                {/* Dossier Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1E293B]/60 mb-4">
                  {/* Channel info & trust */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0A0F1A] border border-[#1E293B] flex items-center justify-center text-sm font-bold text-[#F1F5F9] font-[family-name:var(--font-geist-mono)] shadow-inner">
                      {rec.videos.channels.channel_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/channel?id=${rec.videos.channel_id}`}
                          className="font-bold text-sm text-[#F1F5F9] hover:text-[#00D4AA] transition-colors"
                        >
                          {rec.videos.channels.channel_name}
                        </Link>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#00D4AA]/10 text-[#00D4AA] border border-[#00D4AA]/20 font-[family-name:var(--font-geist-mono)] flex items-center gap-1">
                          <ShieldCheck size={10} />
                          Trust {trustWeight.toFixed(1)}x
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#64748B] mt-0.5 font-[family-name:var(--font-geist-mono)]">
                        <span>{formatDate(rec.videos.published_at)}</span>
                        <span>•</span>
                        <span>{formatRelativeTime(rec.videos.published_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Rating + Conviction + Target Badges */}
                  <div className="flex items-center flex-wrap gap-2 self-start sm:self-auto font-[family-name:var(--font-geist-mono)]">
                    <span className={getSentimentBadgeClass(rec.sentiment)}>
                      <SentimentArrow value={rec.sentiment} />
                      {getSentimentLabel(rec.sentiment)}
                    </span>
                    {rec.target_price !== null && (
                      <span className="text-xs font-bold text-[#F1F5F9] bg-[#0A0F1A] border border-[#1E293B] px-2.5 py-1 rounded-lg">
                        Target <span className="text-[#00FFD0]">${rec.target_price.toFixed(2)}</span>
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0A0F1A] border border-[#1E293B]">
                      <span className="text-[10px] text-[#64748B]">Conviction</span>
                      <ConvictionDots level={rec.conviction_level} />
                    </div>
                  </div>
                </div>

                {/* Catalyst Pull Quote */}
                {rec.catalyst_notes && (
                  <div className="mb-5 p-4 rounded-xl bg-[#0A0F1A]/60 border border-[#1E293B] relative overflow-hidden">
                    <Quote className="absolute top-2 right-3 w-8 h-8 text-[#1E293B]/40 pointer-events-none" />
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-1 self-stretch rounded-full shrink-0 ${
                          isRecBull ? 'bg-[#00D4AA]' : isRecBear ? 'bg-[#FF4D6A]' : 'bg-[#64748B]'
                        }`}
                      />
                      <p className="text-sm text-[#E2E8F0] font-normal leading-relaxed italic relative z-10">
                        {rec.catalyst_notes}
                      </p>
                    </div>
                  </div>
                )}

                {/* Source Video Preview Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-[#0A0F1A]/40 border border-[#1E293B]/60 group/vid hover:border-[#00D4AA]/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0 rounded-lg overflow-hidden w-20 h-12 bg-[#0A0F1A] border border-[#1E293B]">
                      <img
                        src={`https://i.ytimg.com/vi/${rec.videos.youtube_video_id}/mqdefault.jpg`}
                        alt=""
                        className="w-full h-full object-cover opacity-80 group-hover/vid:opacity-100 transition-opacity"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-5 h-5 rounded-full bg-[#0A0F1A]/80 flex items-center justify-center group-hover/vid:scale-110 transition-transform">
                          <Play size={8} className="ml-0.5 text-[#00D4AA]" fill="currentColor" />
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-[#F1F5F9] font-medium truncate group-hover/vid:text-[#00D4AA] transition-colors">
                        {rec.videos.title || `Deep Dive by ${rec.videos.channels.channel_name}`}
                      </p>
                      <span className="text-[10px] text-[#64748B] font-[family-name:var(--font-geist-mono)]">
                        YouTube Analysis Source
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/video?id=${rec.videos.youtube_video_id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#8B95A8] group-hover/vid:text-[#00D4AA] bg-[#141B2D] border border-[#1E293B] group-hover/vid:border-[#00D4AA]/40 transition-all shrink-0 self-end sm:self-auto font-[family-name:var(--font-geist-mono)]"
                  >
                    <span>Inspect Video Signal</span>
                    <ArrowUpRight size={14} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* VIEW MODE 2: High-Density Bloomberg Terminal Ledger */}
      {viewMode === 'ledger' && displayedSignals.length > 0 && (
        <div className="rounded-2xl border border-white/5 bg-[#141B2D]/70 backdrop-blur-xl overflow-hidden shadow-xl">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1E293B] bg-[#0A0F1A]/80 text-[11px] font-bold text-[#64748B] font-[family-name:var(--font-geist-mono)] tracking-wider uppercase">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Analyst Channel</th>
                  <th className="py-3 px-4">Signal</th>
                  <th className="py-3 px-4">Target Price</th>
                  <th className="py-3 px-4">Conviction</th>
                  <th className="py-3 px-4">Thesis Catalyst</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/40 text-xs">
                {displayedSignals.map((rec, index) => {
                  const isRecBull = rec.sentiment >= 0.5
                  const isRecBear = rec.sentiment <= -0.5
                  const rowId = `${rec.videos.youtube_video_id}-${index}`
                  const isExpanded = expandedRow === rowId

                  return (
                    <tr
                      key={rowId}
                      className="hover:bg-[#1E293B]/30 transition-colors group"
                    >
                      {/* Date */}
                      <td className="py-3 px-4 whitespace-nowrap font-[family-name:var(--font-geist-mono)] text-[#8B95A8]">
                        <div>{formatDate(rec.videos.published_at)}</div>
                        <div className="text-[10px] text-[#64748B]">
                          {formatRelativeTime(rec.videos.published_at)}
                        </div>
                      </td>

                      {/* Channel */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/channel?id=${rec.videos.channel_id}`}
                            className="font-bold text-[#F1F5F9] hover:text-[#00D4AA] transition-colors"
                          >
                            {rec.videos.channels.channel_name}
                          </Link>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#00D4AA]/10 text-[#00D4AA] border border-[#00D4AA]/20 font-[family-name:var(--font-geist-mono)]">
                            {(rec.videos.channels.trust_weight || 1.0).toFixed(1)}x
                          </span>
                        </div>
                      </td>

                      {/* Signal */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={getSentimentBadgeClass(rec.sentiment)}>
                          <SentimentArrow value={rec.sentiment} />
                          {getSentimentLabel(rec.sentiment)}
                        </span>
                      </td>

                      {/* Target Price */}
                      <td className="py-3 px-4 whitespace-nowrap font-[family-name:var(--font-geist-mono)] font-bold">
                        {rec.target_price !== null ? (
                          <span className="text-[#00FFD0] bg-[#0A0F1A] px-2 py-1 rounded-md border border-[#1E293B]">
                            ${rec.target_price.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-[#64748B]">—</span>
                        )}
                      </td>

                      {/* Conviction */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <ConvictionDots level={rec.conviction_level} />
                          <span className="text-[10px] font-bold text-[#8B95A8] font-[family-name:var(--font-geist-mono)]">
                            {rec.conviction_level}/10
                          </span>
                        </div>
                      </td>

                      {/* Thesis Catalyst */}
                      <td className="py-3 px-4 max-w-xs">
                        {rec.catalyst_notes ? (
                          <div>
                            <p
                              className={`text-[#CBD5E1] text-xs leading-relaxed ${
                                isExpanded ? '' : 'line-clamp-1'
                              }`}
                            >
                              &ldquo;{rec.catalyst_notes}&rdquo;
                            </p>
                            {rec.catalyst_notes.length > 60 && (
                              <button
                                onClick={() => toggleRowExpand(rowId)}
                                className="text-[10px] text-[#00D4AA] hover:underline font-[family-name:var(--font-geist-mono)] mt-0.5"
                              >
                                {isExpanded ? 'Show less' : 'Read full thesis'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#64748B] italic text-[11px]">No notes recorded</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-[family-name:var(--font-geist-mono)]">
                        <Link
                          href={`/video?id=${rec.videos.youtube_video_id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-[#8B95A8] hover:text-[#00D4AA] bg-[#0A0F1A] border border-[#1E293B] hover:border-[#00D4AA]/40 transition-all"
                        >
                          <Play size={10} fill="currentColor" />
                          <span>Watch</span>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Ledger Condensed Cards */}
          <div className="block md:hidden divide-y divide-[#1E293B]/40">
            {displayedSignals.map((rec, index) => {
              const rowId = `m-${rec.videos.youtube_video_id}-${index}`
              const isExpanded = expandedRow === rowId

              return (
                <div key={rowId} className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#F1F5F9]">
                        {rec.videos.channels.channel_name}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#00D4AA]/10 text-[#00D4AA] border border-[#00D4AA]/20 font-[family-name:var(--font-geist-mono)]">
                        {(rec.videos.channels.trust_weight || 1.0).toFixed(1)}x
                      </span>
                    </div>
                    <span className="text-[10px] text-[#64748B] font-[family-name:var(--font-geist-mono)]">
                      {formatRelativeTime(rec.videos.published_at)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className={getSentimentBadgeClass(rec.sentiment)}>
                      <SentimentArrow value={rec.sentiment} />
                      {getSentimentLabel(rec.sentiment)}
                    </span>

                    {rec.target_price !== null && (
                      <span className="text-xs font-bold font-[family-name:var(--font-geist-mono)] text-[#00FFD0] bg-[#0A0F1A] px-2 py-0.5 rounded border border-[#1E293B]">
                        ${rec.target_price.toFixed(2)}
                      </span>
                    )}

                    <div className="flex items-center gap-1 font-[family-name:var(--font-geist-mono)] text-[10px] text-[#8B95A8]">
                      <span>Conv:</span>
                      <span className="text-[#00D4AA] font-bold">{rec.conviction_level}/10</span>
                    </div>
                  </div>

                  {rec.catalyst_notes && (
                    <div className="text-xs text-[#CBD5E1] bg-[#0A0F1A]/50 p-2.5 rounded-lg border border-[#1E293B]">
                      <p className={isExpanded ? '' : 'line-clamp-2'}>
                        &ldquo;{rec.catalyst_notes}&rdquo;
                      </p>
                      {rec.catalyst_notes.length > 80 && (
                        <button
                          onClick={() => toggleRowExpand(rowId)}
                          className="text-[10px] text-[#00D4AA] font-bold font-[family-name:var(--font-geist-mono)] mt-1"
                        >
                          {isExpanded ? 'Less' : 'More'}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <Link
                      href={`/video?id=${rec.videos.youtube_video_id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-[#00D4AA] bg-[#0A0F1A] border border-[#00D4AA]/30 font-[family-name:var(--font-geist-mono)]"
                    >
                      <Play size={10} fill="currentColor" />
                      <span>Watch Signal</span>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Progressive Disclosure & Pagination Bar */}
      {filteredAndSortedSignals.length > 0 && (
        <div className="p-4 rounded-2xl bg-[#141B2D]/60 border border-white/5 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4 font-[family-name:var(--font-geist-mono)] text-xs">
          {/* Progress metric */}
          <div className="w-full sm:w-auto flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <span className="text-[#8B95A8]">
              Showing <strong className="text-[#F1F5F9]">{displayedSignals.length}</strong> of{' '}
              <strong className="text-[#F1F5F9]">{filteredAndSortedSignals.length}</strong> signals
            </span>
            <div className="w-full sm:w-32 h-1.5 rounded-full bg-[#0A0F1A] border border-[#1E293B] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#00D4AA] to-[#00FFD0] transition-all duration-300"
                style={{
                  width: `${(displayedSignals.length / filteredAndSortedSignals.length) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {hasMore ? (
              <>
                <button
                  onClick={handleLoadMore}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-[#00D4AA]/15 hover:bg-[#00D4AA]/25 text-[#00D4AA] border border-[#00D4AA]/40 font-bold transition-all hover:scale-[1.02] flex items-center justify-center gap-1.5"
                >
                  <span>Load {Math.min(stepSize, filteredAndSortedSignals.length - displayedSignals.length)} More</span>
                  <ChevronDown size={14} />
                </button>
                <button
                  onClick={handleShowAll}
                  className="px-3 py-2 rounded-xl bg-[#0A0F1A] hover:bg-[#1E293B] text-[#8B95A8] hover:text-[#F1F5F9] border border-[#1E293B] font-medium transition-all"
                >
                  Show All ({filteredAndSortedSignals.length})
                </button>
              </>
            ) : visibleCount > (viewMode === 'dossier' ? 6 : 12) ? (
              <button
                onClick={handleCollapse}
                className="px-4 py-2 rounded-xl bg-[#0A0F1A] hover:bg-[#1E293B] text-[#8B95A8] hover:text-[#F1F5F9] border border-[#1E293B] font-bold transition-all flex items-center gap-1.5"
              >
                <span>Collapse to Recent</span>
                <ChevronUp size={14} />
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
