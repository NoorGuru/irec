'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, ChevronDown, ChevronUp, Activity, BarChart2, ArrowUpDown } from 'lucide-react'
import { formatRelativeTime, formatLocalTime } from '@/lib/utils'
import { StockDirectoryItem } from '@/lib/types'
import { getSentimentLabel, getSentimentBadgeClass, PulseBar, ConvictionMini } from '@/components/TickerRow'
import Loading from '@/components/ui/loading'

type ViewMode = 'signals' | 'directory'
type SortField = 'ticker' | 'price' | 'change' | 'score' | 'mentions' | 'sentiment' | 'conviction' | 'target'
type SortOrder = 'asc' | 'desc'
type FilterTier = 'all' | 'tier1' | 'tier2'

interface RatingFilter {
  key: string
  label: string
  color: string
  activeColor: string
  activeBg: string
  activeBorder: string
}

const RATING_FILTERS: RatingFilter[] = [
  { key: '', label: 'All', color: 'text-[#8B95A8]', activeColor: 'text-[#F1F5F9]', activeBg: 'bg-[#1E293B]', activeBorder: 'border-[#2D3A4F]' },
  { key: 'strong-buy', label: 'Strong Buy', color: 'text-[#00FFD0]/60', activeColor: 'text-[#00FFD0]', activeBg: 'bg-[#00FFD0]/10', activeBorder: 'border-[#00FFD0]/30' },
  { key: 'buy', label: 'Buy', color: 'text-[#00D4AA]/60', activeColor: 'text-[#00D4AA]', activeBg: 'bg-[#00D4AA]/10', activeBorder: 'border-[#00D4AA]/30' },
  { key: 'neutral', label: 'Neutral', color: 'text-[#8B95A8]/60', activeColor: 'text-[#8B95A8]', activeBg: 'bg-[#8B95A8]/10', activeBorder: 'border-[#8B95A8]/30' },
  { key: 'sell', label: 'Sell', color: 'text-[#FF4D6A]/60', activeColor: 'text-[#FF4D6A]', activeBg: 'bg-[#FF4D6A]/10', activeBorder: 'border-[#FF4D6A]/30' },
  { key: 'strong-sell', label: 'Strong Sell', color: 'text-[#FF1744]/60', activeColor: 'text-[#FF1744]', activeBg: 'bg-[#FF1744]/10', activeBorder: 'border-[#FF1744]/30' },
]



export default function ExplorePage() {
  const router = useRouter()
  const [stocks, setStocks] = useState<StockDirectoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // View Mode
  const [viewMode, setViewMode] = useState<ViewMode>('signals')

  // Common Filters
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('score')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Signals Filters
  const [ratingFilter, setRatingFilter] = useState('')
  const [hasTargetOnly, setHasTargetOnly] = useState(false)
  const [highDataOnly, setHighDataOnly] = useState(false)

  // Directory Filters
  const [filterTier, setFilterTier] = useState<FilterTier>('all')
  const [visibleCount, setVisibleCount] = useState(25)

  useEffect(() => {
    let active = true

    async function fetchStocks() {
      try {
        const cached = localStorage.getItem('aura_stocks_directory_v6')
        let localEtag = null
        if (cached) {
          try {
            const parsed = JSON.parse(cached)
            if (parsed && parsed.stocks) {
              if (active) {
                setStocks(parsed.stocks)
                setLoading(false)
                localEtag = parsed.generated_at
              }
            }
          } catch(e) {}
        }

        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
        const headers: HeadersInit = {}
        if (localEtag) headers['If-None-Match'] = `W/"${localEtag}"`

        const res = await fetch(`${backendUrl}/api/v1/stocks`, { headers })

        if (res.status === 304) return
        if (!res.ok) throw new Error('Failed to fetch')

        const json = await res.json()
        if (active) {
          setStocks(json.stocks)
          setError(null)
          localStorage.setItem('aura_stocks_directory_v6', JSON.stringify(json))
        }
      } catch (err: any) {
        if (active) {
          if (!stocks.length) setError(err.message)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchStocks()
    return () => { active = false }
  }, [])

  // Auto-switch sort defaults when view mode changes
  useEffect(() => {
    if (viewMode === 'signals') {
      setSortField('mentions')
      setSortOrder('desc')
    } else {
      setSortField('score')
      setSortOrder('desc')
    }
  }, [viewMode])

  useEffect(() => {
    setVisibleCount(25)
  }, [viewMode, search, sortField, sortOrder, ratingFilter, hasTargetOnly, highDataOnly, filterTier])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-[#334155] group-hover:text-[#64748B] transition-colors inline-block" />
    return sortOrder === 'asc' ? <ChevronUp className="w-4 h-4 text-[#00D4AA] inline-block" /> : <ChevronDown className="w-4 h-4 text-[#00D4AA] inline-block" />
  }

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { '': 0, 'strong-buy': 0, buy: 0, neutral: 0, sell: 0, 'strong-sell': 0 }
    if (viewMode !== 'signals') return counts

    let baseList = stocks.filter(s => s.overall_sentiment !== null && s.mention_count_30d > 0)
    counts[''] = baseList.length

    for (const t of baseList) {
      const s = t.overall_sentiment!
      if (s >= 1.5) counts['strong-buy']++
      else if (s >= 0.5) counts['buy']++
      else if (s > -0.5) counts['neutral']++
      else if (s > -1.5) counts['sell']++
      else counts['strong-sell']++
    }
    return counts
  }, [stocks, viewMode])

  const filteredAndSorted = useMemo(() => {
    if (!stocks.length) return []

    let result = stocks.filter(s => {
      // 1. View Mode Filtering
      if (viewMode === 'signals') {
        // Must have recent signals/sentiment
        if (s.overall_sentiment === null || s.mention_count_30d === 0) return false

        // Rating Filter
        if (ratingFilter === 'strong-buy' && s.overall_sentiment < 1.5) return false
        if (ratingFilter === 'buy' && (s.overall_sentiment < 0.5 || s.overall_sentiment >= 1.5)) return false
        if (ratingFilter === 'neutral' && (s.overall_sentiment <= -0.5 || s.overall_sentiment >= 0.5)) return false
        if (ratingFilter === 'sell' && (s.overall_sentiment <= -1.5 || s.overall_sentiment > -0.5)) return false
        if (ratingFilter === 'strong-sell' && s.overall_sentiment > -1.5) return false

        // Target / Data
        if (hasTargetOnly && s.avg_target_price === null) return false
        if (highDataOnly && s.mention_count_30d < 3) return false
      } else {
        // Directory Mode Filtering
        if (filterTier === 'tier1' && s.tier !== 1) return false
        if (filterTier === 'tier2' && s.tier !== 2) return false
      }

      // 2. Global Search
      if (search) {
        const q = search.toLowerCase()
        const matchTicker = s.ticker.toLowerCase().includes(q)
        const matchName = s.stock_name?.toLowerCase().includes(q) || false
        if (!matchTicker && !matchName) return false
      }

      // 3. Fallback filtering for sorts
      if (sortField === 'price' && s.current_price == null) return false
      if (sortField === 'change' && s.price_change_pct == null) return false

      return true
    })

    // Sort
    result.sort((a, b) => {
      let valA: any = null
      let valB: any = null

      if (sortField === 'ticker') {
        valA = a.ticker
        valB = b.ticker
      } else if (sortField === 'score') {
        valA = a.priority_score
        valB = b.priority_score
      } else if (sortField === 'change') {
        valA = a.price_change_pct ?? -9999
        valB = b.price_change_pct ?? -9999
      } else if (sortField === 'price') {
        valA = a.current_price ?? -9999
        valB = b.current_price ?? -9999
      } else if (sortField === 'mentions') {
        valA = a.mention_count_30d
        valB = b.mention_count_30d
      } else if (sortField === 'sentiment') {
        valA = a.overall_sentiment ?? -9999
        valB = b.overall_sentiment ?? -9999
      } else if (sortField === 'conviction') {
        valA = a.avg_conviction ?? -9999
        valB = b.avg_conviction ?? -9999
      } else if (sortField === 'target') {
        valA = a.avg_target_price ?? -9999
        valB = b.avg_target_price ?? -9999
      }

      if (valA === valB) return 0

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }

      if (valA == null) return sortOrder === 'asc' ? 1 : 1
      if (valB == null) return sortOrder === 'asc' ? -1 : -1

      return sortOrder === 'asc' ? valA - valB : valB - valA
    })

    return result
  }, [stocks, search, viewMode, ratingFilter, hasTargetOnly, highDataOnly, filterTier, sortField, sortOrder])

  if (loading && !stocks.length) {
    return <Loading title="Market Explorer" subtitle="Loading assets and signals..." />
  }

  return (
    <main className="flex-1 flex flex-col relative w-full bg-[#0A0F1A] overflow-hidden">
      {/* Background Gradient */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.015] mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#141B2D]/40 via-[#0A0F1A] to-[#0A0F1A] pointer-events-none z-0" />

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-8 py-8 md:py-12 w-full flex-1 flex flex-col animate-fade-up">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-[family-name:var(--font-geist-mono)] font-extralight tracking-tight text-[#F1F5F9]">
              Explore
            </h1>
            <div className="flex items-center bg-[#141B2D]/60 border border-[#1E293B] rounded-xl p-1">
              <button
                onClick={() => setViewMode('signals')}
                className={`px-4 py-2 rounded-lg text-sm font-bold tracking-wide transition-colors duration-200 ${viewMode === 'signals' ? 'bg-[#00D4AA]/20 text-[#00D4AA]' : 'text-[#64748B] hover:text-[#F1F5F9]'}`}
              >
                Active Setups
              </button>
              <button
                onClick={() => setViewMode('directory')}
                className={`px-4 py-2 rounded-lg text-sm font-bold tracking-wide transition-colors duration-200 ${viewMode === 'directory' ? 'bg-[#1E293B] text-[#F1F5F9] shadow-sm' : 'text-[#64748B] hover:text-[#F1F5F9]'}`}
              >
                All Assets
              </button>
            </div>
          </div>
          <p className="text-[#8B95A8] max-w-2xl text-lg font-light leading-relaxed">
            {viewMode === 'signals' 
              ? "Discover active market signals extracted from analyst coverage. Filter by sentiment and conviction." 
              : `Comprehensive directory of ${stocks.length} tracked assets, prices, and Aura priority scores.`}
          </p>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center mb-8">
          
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto flex-1">
            {/* Left: Search */}
            <div className="relative w-full sm:max-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <input 
                type="text"
                placeholder="Search ticker or name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[#141B2D]/50 border border-[#1E293B] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#F1F5F9] placeholder:text-[#475569] outline-none focus:border-[#00D4AA]/50 transition-colors font-[family-name:var(--font-geist-mono)]"
              />
            </div>

            {/* Mobile Sort Dropdown */}
            <div className="relative w-full sm:w-[200px] lg:hidden">
              <select 
                value={`${sortField}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-') as [SortField, SortOrder]
                  setSortField(field)
                  setSortOrder(order)
                }}
                className="w-full appearance-none bg-[#141B2D]/50 border border-[#1E293B] rounded-xl pl-4 pr-10 py-2.5 text-sm text-[#F1F5F9] outline-none focus:border-[#00D4AA]/50 transition-colors font-[family-name:var(--font-geist-mono)]"
              >
                {viewMode === 'signals' ? (
                  <>
                    <option value="mentions-desc">Sort: Mentions (High)</option>
                    <option value="sentiment-desc">Sort: Sentiment (High)</option>
                    <option value="conviction-desc">Sort: Conviction (High)</option>
                    <option value="target-desc">Sort: Target (High)</option>
                    <option value="change-desc">Sort: Change (High)</option>
                  </>
                ) : (
                  <>
                    <option value="score-desc">Sort: Aura Score (High)</option>
                    <option value="mentions-desc">Sort: Mentions (High)</option>
                    <option value="change-desc">Sort: Change (High)</option>
                    <option value="change-asc">Sort: Change (Low)</option>
                  </>
                )}
              </select>
              <ArrowUpDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B] pointer-events-none" />
            </div>
          </div>

          {/* Right: Mode-Specific Filters & Sort */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto pb-2 pt-1 sm:pb-0 sm:pt-0">
            
            {viewMode === 'signals' && (
              <>
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {RATING_FILTERS.map(rf => {
                    const isActive = ratingFilter === rf.key
                    const count = filterCounts[rf.key] ?? 0
                    return (
                      <button
                        key={rf.key}
                        onClick={() => setRatingFilter(ratingFilter === rf.key ? '' : rf.key)}
                        className={`
                          shrink-0 relative px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border whitespace-nowrap
                          ${isActive ? `${rf.activeBg} ${rf.activeBorder} ${rf.activeColor}` : `bg-transparent border-[#1E293B] ${rf.color} hover:bg-[#141B2D]/40`}
                        `}
                      >
                        {rf.label}
                        {rf.key !== '' && (
                          <span className={`ml-1.5 font-[family-name:var(--font-geist-mono)] text-[10px] ${isActive ? 'opacity-80' : 'opacity-50'}`}>
                            {count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <div className="w-px h-6 bg-[#1E293B] shrink-0 mx-1 hidden sm:block" />
                <button
                  onClick={() => setHasTargetOnly(!hasTargetOnly)}
                  className={`shrink-0 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 whitespace-nowrap ${hasTargetOnly ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]' : 'bg-[#141B2D]/40 border-[#1E293B] text-[#64748B] hover:text-[#8B95A8] hover:bg-[#1E293B]/50'}`}
                >
                  <span className="mr-1 text-[#F59E0B]">$</span>Target
                </button>
                <button
                  onClick={() => setHighDataOnly(!highDataOnly)}
                  className={`shrink-0 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 whitespace-nowrap ${highDataOnly ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]' : 'bg-[#141B2D]/40 border-[#1E293B] text-[#64748B] hover:text-[#8B95A8] hover:bg-[#1E293B]/50'}`}
                >
                  <span className="mr-1">📊</span>High Data
                </button>
              </>
            )}

            {viewMode === 'directory' && (
              <div className="flex flex-wrap items-center p-1 bg-[#141B2D]/40 border border-[#1E293B] rounded-xl shrink-0 w-full sm:w-auto">
                <button onClick={() => setFilterTier('all')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold font-[family-name:var(--font-geist-mono)] tracking-wider whitespace-nowrap transition-colors ${filterTier === 'all' ? 'bg-[#1E293B] text-[#F1F5F9] shadow-sm' : 'text-[#8B95A8] hover:text-[#F1F5F9]'}`}>ALL ASSETS</button>
                <button onClick={() => setFilterTier('tier1')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold font-[family-name:var(--font-geist-mono)] tracking-wider whitespace-nowrap transition-colors flex items-center justify-center gap-1.5 ${filterTier === 'tier1' ? 'bg-[#00D4AA]/20 text-[#00D4AA] shadow-sm' : 'text-[#8B95A8] hover:text-[#00D4AA]'}`}><Activity className="w-3.5 h-3.5" />TRENDING</button>
                <button onClick={() => setFilterTier('tier2')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold font-[family-name:var(--font-geist-mono)] tracking-wider whitespace-nowrap transition-colors flex items-center justify-center gap-1.5 ${filterTier === 'tier2' ? 'bg-[#1E293B] text-[#F1F5F9] shadow-sm' : 'text-[#8B95A8] hover:text-[#F1F5F9]'}`}><BarChart2 className="w-3.5 h-3.5" />EXTENDED</button>
              </div>
            )}

          </div>
        </div>

        {/* Desktop Unified Table */}
        <div className="hidden lg:block rounded-2xl border border-[#1E293B] bg-[#0A0F1A]/60 backdrop-blur-md overflow-hidden animate-fade-up">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#1E293B] bg-[#141B2D]/40">
                  <th className="px-5 py-4 text-xs font-bold text-[#8B95A8] font-[family-name:var(--font-geist-mono)] uppercase tracking-wider cursor-pointer group" onClick={() => toggleSort('ticker')}>
                    <div className="flex items-center gap-1 group-hover:text-[#F1F5F9]">Asset <SortIcon field="ticker" /></div>
                  </th>
                  <th className="px-5 py-4 text-xs font-bold text-[#8B95A8] font-[family-name:var(--font-geist-mono)] uppercase tracking-wider cursor-pointer group" onClick={() => toggleSort('price')}>
                    <div className="flex items-center gap-1 group-hover:text-[#F1F5F9]">Price <SortIcon field="price" /></div>
                  </th>
                  <th className="px-5 py-4 text-xs font-bold text-[#8B95A8] font-[family-name:var(--font-geist-mono)] uppercase tracking-wider cursor-pointer group" onClick={() => toggleSort('change')}>
                    <div className="flex items-center gap-1 group-hover:text-[#F1F5F9]">24H <SortIcon field="change" /></div>
                  </th>
                  {viewMode === 'signals' && (
                    <th className="px-5 py-4 text-xs font-bold text-[#8B95A8] font-[family-name:var(--font-geist-mono)] uppercase tracking-wider cursor-pointer group" onClick={() => toggleSort('target')}>
                      <div className="flex items-center gap-1 group-hover:text-[#F1F5F9]">Target <SortIcon field="target" /></div>
                    </th>
                  )}
                  <th className="px-5 py-4 text-xs font-bold text-[#8B95A8] font-[family-name:var(--font-geist-mono)] uppercase tracking-wider cursor-pointer group" onClick={() => toggleSort('sentiment')}>
                    <div className="flex items-center gap-1 group-hover:text-[#F1F5F9]">Sentiment <SortIcon field="sentiment" /></div>
                  </th>
                  {viewMode === 'signals' && (
                    <th className="px-5 py-4 text-xs font-bold text-[#8B95A8] font-[family-name:var(--font-geist-mono)] uppercase tracking-wider cursor-pointer group" onClick={() => toggleSort('conviction')}>
                      <div className="flex items-center gap-1 group-hover:text-[#F1F5F9]">Conviction <SortIcon field="conviction" /></div>
                    </th>
                  )}
                  {viewMode === 'directory' && (
                    <th className="px-5 py-4 text-xs font-bold text-[#8B95A8] font-[family-name:var(--font-geist-mono)] uppercase tracking-wider cursor-pointer group" onClick={() => toggleSort('score')}>
                      <div className="flex items-center gap-1 group-hover:text-[#F1F5F9]">Aura Score <SortIcon field="score" /></div>
                    </th>
                  )}
                  <th className="px-5 py-4 text-xs font-bold text-[#8B95A8] font-[family-name:var(--font-geist-mono)] uppercase tracking-wider cursor-pointer group" onClick={() => toggleSort('mentions')}>
                    <div className="flex items-center gap-1 group-hover:text-[#F1F5F9]">Coverage <SortIcon field="mentions" /></div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/50">
                {filteredAndSorted.slice(0, visibleCount).map((stock) => {
                  const direction = stock.overall_sentiment ? (stock.overall_sentiment >= 0.5 ? 'BUY' : stock.overall_sentiment <= -0.5 ? 'SELL' : 'NEUTRAL') : 'NEUTRAL'
                  const borderGlowClass = viewMode === 'signals' ? (direction === 'BUY' ? 'border-l-2 border-l-[#00D4AA]' : direction === 'SELL' ? 'border-l-2 border-l-[#FF4D6A]' : 'border-l-2 border-l-[#8B95A8]') : 'border-l-2 border-l-transparent'
                  
                  return (
                    <tr 
                      key={stock.ticker} 
                      onClick={() => router.push(`/ticker?s=${stock.ticker}`)}
                      className={`group hover:bg-[#1E293B]/30 transition-colors cursor-pointer ${borderGlowClass}`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex flex-col justify-center min-w-[120px]">
                          <div className="flex items-baseline gap-2">
                            <span className="text-lg font-black font-[family-name:var(--font-geist-mono)] text-[#F1F5F9] group-hover:text-[#00D4AA] transition-colors leading-none tracking-wide">
                              {stock.ticker}
                            </span>
                            {stock.mention_count_30d > 0 && stock.mention_count_30d < 3 && viewMode === 'signals' && (
                              <span className="inline-flex items-center text-[8px] text-[#F59E0B]/80 bg-[#F59E0B]/10 px-1 py-0.5 rounded leading-none shrink-0 font-medium border border-[#F59E0B]/20">low data</span>
                            )}
                          </div>
                          <span className="text-[10px] text-[#64748B] max-w-[160px] truncate mt-1">{stock.stock_name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">
                            {stock.current_price != null ? `$${stock.current_price.toFixed(2)}` : '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {stock.price_change_pct != null ? (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold font-[family-name:var(--font-geist-mono)] border ${stock.price_change_pct >= 0 ? 'bg-[#00D4AA]/10 text-[#00D4AA] border-[#00D4AA]/20' : 'bg-[#FF4D6A]/10 text-[#FF4D6A] border-[#FF4D6A]/20'}`}>
                            {stock.price_change_pct > 0 ? '+' : ''}{stock.price_change_pct.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-[#64748B]">—</span>
                        )}
                      </td>
                      {viewMode === 'signals' && (
                        <td className="px-5 py-4">
                          {stock.avg_target_price !== null ? (
                            <span className="font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[#F1F5F9]">
                              ${stock.avg_target_price.toFixed(0)}
                            </span>
                          ) : (
                            <span className="text-[#64748B] text-xs">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-5 py-4 min-w-[150px]">
                        {stock.overall_sentiment !== null ? (
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className={getSentimentBadgeClass(stock.overall_sentiment)}>
                                {getSentimentLabel(stock.overall_sentiment)}
                              </span>
                              <span className="font-[family-name:var(--font-geist-mono)] text-[#64748B]">{stock.overall_sentiment.toFixed(2)}</span>
                            </div>
                            <PulseBar value={stock.overall_sentiment} isTop={false} />
                          </div>
                        ) : (
                          <span className="text-[#64748B] text-xs">No Data</span>
                        )}
                      </td>
                      
                      {viewMode === 'signals' && (
                        <td className="px-5 py-4">
                          {stock.avg_conviction !== null ? <ConvictionMini level={stock.avg_conviction} /> : <span className="text-[#64748B] text-xs">—</span>}
                        </td>
                      )}

                      {viewMode === 'directory' && (
                        <td className="px-5 py-4">
                          <span className="text-sm font-bold font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">
                            {stock.priority_score.toFixed(3)}
                          </span>
                        </td>
                      )}

                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">{stock.mention_count_30d}</span>
                            <span className="text-[#8B95A8] text-[10px]">mentions</span>
                          </div>
                          {viewMode === 'signals' && stock.analyst_count > 0 && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="font-[family-name:var(--font-geist-mono)] text-[#64748B]">{stock.analyst_count}</span>
                              <span className="text-[#64748B] text-[10px]">analysts</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden flex flex-col gap-3 pb-8">
          {filteredAndSorted.slice(0, visibleCount).map((stock) => {
            const direction = stock.overall_sentiment ? (stock.overall_sentiment >= 0.5 ? 'BUY' : stock.overall_sentiment <= -0.5 ? 'SELL' : 'NEUTRAL') : 'NEUTRAL'
            const borderClass = viewMode === 'signals' ? (direction === 'BUY' ? 'border-l-4 border-l-[#00D4AA] border-r border-y border-[#1E293B]' : direction === 'SELL' ? 'border-l-4 border-l-[#FF4D6A] border-r border-y border-[#1E293B]' : 'border border-[#1E293B]') : 'border border-[#1E293B]'

            return (
              <Link key={stock.ticker} href={`/ticker?s=${stock.ticker}`} className={`block rounded-xl bg-[#141B2D]/60 p-4 active:scale-[0.98] transition-all shadow-md ${borderClass}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black font-[family-name:var(--font-geist-mono)] text-[#F1F5F9] tracking-wide">{stock.ticker}</span>
                      {stock.mention_count_30d > 0 && stock.mention_count_30d < 3 && viewMode === 'signals' && (
                        <span className="inline-flex items-center text-[9px] text-[#F59E0B]/80 bg-[#F59E0B]/10 px-1 py-0.5 rounded leading-none shrink-0 font-medium border border-[#F59E0B]/20">low data</span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#64748B] truncate max-w-[180px] mt-0.5">{stock.stock_name || 'Unknown'}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-lg font-black font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">
                      {stock.current_price != null ? `$${stock.current_price.toFixed(2)}` : '—'}
                    </span>
                    {stock.price_change_pct != null && (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-[family-name:var(--font-geist-mono)] border ${stock.price_change_pct >= 0 ? 'bg-[#00D4AA]/10 text-[#00D4AA] border-[#00D4AA]/20' : 'bg-[#FF4D6A]/10 text-[#FF4D6A] border-[#FF4D6A]/20'}`}>
                        {stock.price_change_pct > 0 ? '+' : ''}{stock.price_change_pct.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-3">
                  <div className="flex-1">
                    {stock.overall_sentiment !== null && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={getSentimentBadgeClass(stock.overall_sentiment)}>
                            {getSentimentLabel(stock.overall_sentiment)}
                          </span>
                          <span className="font-[family-name:var(--font-geist-mono)] text-[#8B95A8]">{stock.overall_sentiment.toFixed(2)}</span>
                        </div>
                        <PulseBar value={stock.overall_sentiment} isTop={false} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-end justify-between pt-3 border-t border-[#1E293B]/60">
                  {viewMode === 'signals' ? (
                    <>
                      <div className="flex flex-col gap-1 w-1/3">
                        <span className="text-[9px] font-bold text-[#8B95A8] uppercase tracking-wider font-[family-name:var(--font-geist-mono)]">Target</span>
                        {stock.avg_target_price !== null ? (
                          <span className="font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[#F1F5F9]">
                            ${stock.avg_target_price.toFixed(0)}
                          </span>
                        ) : <span className="text-[#64748B] text-xs">—</span>}
                      </div>
                      <div className="flex flex-col items-center gap-1 w-1/3">
                        <span className="text-[9px] font-bold text-[#8B95A8] uppercase tracking-wider font-[family-name:var(--font-geist-mono)]">Conviction</span>
                        {stock.avg_conviction !== null ? <ConvictionMini level={stock.avg_conviction} /> : <span className="text-[#64748B] text-xs">—</span>}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-1 w-2/3">
                      <span className="text-[9px] font-bold text-[#8B95A8] uppercase tracking-wider font-[family-name:var(--font-geist-mono)]">Aura Score</span>
                      <span className="font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[#F1F5F9]">
                        {stock.priority_score.toFixed(3)}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col items-end gap-1 w-1/3">
                    <span className="text-[9px] font-bold text-[#8B95A8] uppercase tracking-wider font-[family-name:var(--font-geist-mono)]">Coverage</span>
                    <div className="flex items-center gap-1">
                      <span className="font-[family-name:var(--font-geist-mono)] text-xs font-bold text-[#F1F5F9]">{stock.mention_count_30d}</span>
                      <span className="text-[10px] text-[#64748B]">mentions</span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Load More Button */}
        {filteredAndSorted.length > visibleCount && (
          <div className="pt-4 pb-12 flex justify-center w-full relative z-20">
            <button
              onClick={() => setVisibleCount((c) => c + 25)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[#1E293B] bg-[#141B2D]/80 backdrop-blur-md text-sm font-medium text-[#8B95A8] hover:text-[#00D4AA] hover:border-[#00D4AA]/30 hover:bg-[#1E293B] transition-all duration-200 shadow-lg shadow-black/20"
            >
              <span>Load more</span>
              <span className="font-[family-name:var(--font-geist-mono)] text-[11px] text-[#475569]">
                {filteredAndSorted.length - visibleCount} remaining
              </span>
            </button>
          </div>
        )}

        {filteredAndSorted.length === 0 && !loading && (
          <div className="flex-1 flex items-center justify-center py-20 animate-fade-up">
            <div className="rounded-2xl border border-[#1E293B] bg-[#141B2D]/40 p-12 text-center max-w-sm">
              <div className="w-12 h-12 bg-[#1E293B]/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-6 h-6 text-[#64748B]" />
              </div>
              <p className="text-lg text-[#F1F5F9] font-medium mb-2">No assets found</p>
              <p className="text-sm text-[#8B95A8] leading-relaxed">
                Try adjusting your search or filters to see more results.
              </p>
              <button 
                onClick={() => {
                  setSearch('')
                  setRatingFilter('')
                  setHasTargetOnly(false)
                  setHighDataOnly(false)
                  setFilterTier('all')
                }}
                className="mt-6 text-[#00D4AA] text-sm font-medium hover:underline"
              >
                Clear all filters
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
