'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, ChevronDown, ChevronUp, Activity, BarChart2, ArrowUpDown } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

// --- Types ---

interface StockItem {
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
}

interface StocksDirectoryData {
  stocks: StockItem[]
  generated_at: string
}

type SortField = 'ticker' | 'price' | 'change' | 'score' | 'mentions' | 'sentiment'
type SortOrder = 'asc' | 'desc'
type FilterTier = 'all' | 'tier1' | 'tier2'

// --- Components ---

function SentimentBar({ sentiment }: { sentiment: number | null }) {
  if (sentiment === null) return <div className="text-[#475569] text-xs">No Data</div>
  
  // sentiment ranges from -2 to 2
  const normalized = Math.max(-2, Math.min(2, sentiment))
  // map to 0-100%
  const percentage = ((normalized + 2) / 4) * 100
  
  const isBullish = normalized > 0
  const isBearish = normalized < 0
  
  return (
    <div className="w-24 h-2 bg-[#141B2D] rounded-full overflow-hidden border border-[#1E293B]">
      <div 
        className={`h-full transition-all duration-500 ${isBullish ? 'bg-[#00D4AA]' : isBearish ? 'bg-[#FF4D6A]' : 'bg-[#64748B]'}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

function TierBadge({ tier, isPinned }: { tier: number, isPinned: boolean }) {
  if (tier === 1) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider font-[family-name:var(--font-geist-mono)] bg-[#00D4AA]/10 text-[#00D4AA] border border-[#00D4AA]/20">
        <Activity className="w-3 h-3" />
        INTRADAY
        {isPinned && <span className="ml-0.5 text-[#F1F5F9]" title="Pinned">📌</span>}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider font-[family-name:var(--font-geist-mono)] bg-[#1E293B]/50 text-[#8B95A8] border border-[#1E293B]">
      <BarChart2 className="w-3 h-3" />
      DAILY
    </span>
  )
}

export default function StocksDirectoryPage() {
  const router = useRouter()
  const [data, setData] = useState<StocksDirectoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [search, setSearch] = useState('')
  const [filterTier, setFilterTier] = useState<FilterTier>('all')
  const [sortField, setSortField] = useState<SortField>('score')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  
  useEffect(() => {
    let active = true
    
    async function fetchStocks() {
      try {
        const cached = localStorage.getItem('aura_stocks_directory')
        let localEtag = null
        if (cached) {
          try {
            const parsed = JSON.parse(cached)
            if (parsed && parsed.stocks) {
              if (active) {
                setData(parsed)
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
          setData(json)
          setError(null)
          localStorage.setItem('aura_stocks_directory', JSON.stringify(json))
        }
      } catch (err: any) {
        if (active) {
          if (!data) setError(err.message)
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    
    fetchStocks()
    return () => { active = false }
  }, [])
  
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }
  
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <div className="w-4 h-4" />
    return sortOrder === 'asc' ? <ChevronUp className="w-4 h-4 text-[#00D4AA]" /> : <ChevronDown className="w-4 h-4 text-[#00D4AA]" />
  }

  const filteredAndSorted = useMemo(() => {
    if (!data?.stocks) return []
    
    // Filter
    let result = data.stocks.filter(s => {
      if (filterTier === 'tier1' && s.tier !== 1) return false
      if (filterTier === 'tier2' && s.tier !== 2) return false
      
      if (search) {
        const q = search.toLowerCase()
        const matchTicker = s.ticker.toLowerCase().includes(q)
        const matchName = s.stock_name?.toLowerCase().includes(q) || false
        if (!matchTicker && !matchName) return false
      }

      // Filter out missing price data if actively sorting by price or change
      if (sortField === 'price' && s.current_price == null) return false
      if (sortField === 'change' && s.price_change_pct == null) return false

      return true
    })
    
    // Sort
    result.sort((a, b) => {
      let valA: any = a[sortField]
      let valB: any = b[sortField]
      
      if (sortField === 'score') {
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
  }, [data, search, filterTier, sortField, sortOrder])
  
  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#00D4AA] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#8B95A8] font-mono">Loading markets...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="flex-1 flex flex-col relative w-full">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#141B2D]/40 via-[#0A0F1A] to-[#0A0F1A] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 md:py-12 w-full flex-1 flex flex-col">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-[family-name:var(--font-geist-mono)] font-extralight tracking-tight text-[#F1F5F9] mb-4">
            Stocks
          </h1>
          <p className="text-[#8B95A8] text-lg md:text-xl font-light">
            Coverage directory of <span className="text-[#F1F5F9] font-bold">{data?.stocks.length || 0}</span> assets
          </p>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center mb-8">
          
          {/* Left: Search */}
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <input 
              type="text"
              placeholder="Search ticker or name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#141B2D]/50 border border-[#1E293B] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#F1F5F9] placeholder:text-[#475569] outline-none focus:border-[#00D4AA]/50 transition-colors"
            />
          </div>

          {/* Right: Filters & Sort Group */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            {/* Filter Segmented Control */}
            <div className="flex items-center p-1 bg-[#141B2D]/40 border border-[#1E293B] rounded-xl overflow-x-auto scrollbar-hide">
              <button 
                onClick={() => setFilterTier('all')}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold font-[family-name:var(--font-geist-mono)] tracking-wider whitespace-nowrap transition-colors ${filterTier === 'all' ? 'bg-[#1E293B] text-[#F1F5F9] shadow-sm' : 'text-[#8B95A8] hover:text-[#F1F5F9]'}`}
              >
                ALL ASSETS
              </button>
              <button 
                onClick={() => setFilterTier('tier1')}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold font-[family-name:var(--font-geist-mono)] tracking-wider whitespace-nowrap transition-colors flex items-center justify-center gap-1.5 ${filterTier === 'tier1' ? 'bg-[#00D4AA]/20 text-[#00D4AA] shadow-sm' : 'text-[#8B95A8] hover:text-[#00D4AA]'}`}
              >
                <Activity className="w-3.5 h-3.5" />
                TRENDING
              </button>
              <button 
                onClick={() => setFilterTier('tier2')}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold font-[family-name:var(--font-geist-mono)] tracking-wider whitespace-nowrap transition-colors flex items-center justify-center gap-1.5 ${filterTier === 'tier2' ? 'bg-[#1E293B] text-[#F1F5F9] shadow-sm' : 'text-[#8B95A8] hover:text-[#F1F5F9]'}`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                EXTENDED
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="relative min-w-[200px] w-full sm:w-auto">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <ArrowUpDown className="w-4 h-4 text-[#64748B]" />
              </div>
              <select
                value={`${sortField}-${sortOrder}`}
                onChange={(e) => {
                  const [f, o] = e.target.value.split('-');
                  setSortField(f as SortField);
                  setSortOrder(o as SortOrder);
                }}
                className="w-full bg-[#141B2D]/50 border border-[#1E293B] rounded-xl pl-9 pr-8 py-2.5 text-sm text-[#F1F5F9] appearance-none outline-none focus:border-[#00D4AA]/50 transition-colors font-[family-name:var(--font-geist-mono)]"
              >
                <option value="score-desc">Sort by: Aura Score</option>
                <option value="ticker-asc">Sort by: Ticker (A-Z)</option>
                <option value="ticker-desc">Sort by: Ticker (Z-A)</option>
                <option value="change-desc">Sort by: Change (High to Low)</option>
                <option value="change-asc">Sort by: Change (Low to High)</option>
                <option value="price-desc">Sort by: Price (High to Low)</option>
                <option value="price-asc">Sort by: Price (Low to High)</option>
                <option value="sentiment-desc">Sort by: Sentiment (Bullish)</option>
                <option value="mentions-desc">Sort by: Mentions (Most)</option>
                <option value="mentions-asc">Sort by: Mentions (Least)</option>
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <ChevronDown className="w-4 h-4 text-[#64748B]" />
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block rounded-2xl border border-[#1E293B] bg-[#0A0F1A]/60 backdrop-blur-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#1E293B] bg-[#141B2D]/30">
                  <th className="px-6 py-4 text-xs font-bold text-[#8B95A8] font-[family-name:var(--font-geist-mono)] uppercase tracking-wider cursor-pointer group" onClick={() => toggleSort('ticker')}>
                    <div className="flex items-center gap-1 group-hover:text-[#F1F5F9]">Asset <SortIcon field="ticker" /></div>
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-[#8B95A8] font-[family-name:var(--font-geist-mono)] uppercase tracking-wider cursor-pointer group" onClick={() => toggleSort('price')}>
                    <div className="flex items-center gap-1 group-hover:text-[#F1F5F9]">Price <SortIcon field="price" /></div>
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-[#8B95A8] font-[family-name:var(--font-geist-mono)] uppercase tracking-wider cursor-pointer group" onClick={() => toggleSort('change')}>
                    <div className="flex items-center gap-1 group-hover:text-[#F1F5F9]">24H Change <SortIcon field="change" /></div>
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-[#8B95A8] font-[family-name:var(--font-geist-mono)] uppercase tracking-wider">
                    Coverage Tier
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-[#8B95A8] font-[family-name:var(--font-geist-mono)] uppercase tracking-wider cursor-pointer group" onClick={() => toggleSort('score')}>
                    <div className="flex items-center gap-1 group-hover:text-[#F1F5F9]">Aura Score <SortIcon field="score" /></div>
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-[#8B95A8] font-[family-name:var(--font-geist-mono)] uppercase tracking-wider cursor-pointer group" onClick={() => toggleSort('sentiment')}>
                    <div className="flex items-center gap-1 group-hover:text-[#F1F5F9]">Sentiment <SortIcon field="sentiment" /></div>
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-[#8B95A8] font-[family-name:var(--font-geist-mono)] uppercase tracking-wider cursor-pointer group" onClick={() => toggleSort('mentions')}>
                    <div className="flex items-center gap-1 group-hover:text-[#F1F5F9]">Mentions <SortIcon field="mentions" /></div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/50">
                {filteredAndSorted.map((stock) => (
                  <tr 
                    key={stock.ticker} 
                    onClick={() => router.push(`/ticker?s=${stock.ticker}`)}
                    className="group hover:bg-[#141B2D]/40 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-base font-black font-[family-name:var(--font-geist-mono)] text-[#F1F5F9] group-hover:text-[#00D4AA] transition-colors w-fit">
                          {stock.ticker}
                        </span>
                        <span className="text-xs text-[#64748B] max-w-[200px] truncate">{stock.stock_name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">
                        {stock.current_price != null ? `$${stock.current_price.toFixed(2)}` : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {stock.price_change_pct != null ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold font-[family-name:var(--font-geist-mono)] ${stock.price_change_pct >= 0 ? 'bg-[#00D4AA]/10 text-[#00D4AA]' : 'bg-[#FF4D6A]/10 text-[#FF4D6A]'}`}>
                          {stock.price_change_pct > 0 ? '+' : ''}{stock.price_change_pct.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-[#64748B]">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <TierBadge tier={stock.tier} isPinned={stock.is_pinned} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">
                        {stock.priority_score.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <SentimentBar sentiment={stock.overall_sentiment} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-[family-name:var(--font-geist-mono)] text-[#8B95A8]">
                        {stock.mention_count_30d}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden flex flex-col gap-3">
          {filteredAndSorted.map((stock) => (
            <Link key={stock.ticker} href={`/ticker?s=${stock.ticker}`} className="block rounded-xl border border-[#1E293B] bg-[#141B2D]/40 p-4 active:scale-[0.98] transition-transform">
              <div className="flex items-start justify-between mb-2">
                <div className="flex flex-col">
                  <span className="text-xl font-black font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">{stock.ticker}</span>
                  <span className="text-xs text-[#64748B] truncate max-w-[150px]">{stock.stock_name || 'Unknown'}</span>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <TierBadge tier={stock.tier} isPinned={stock.is_pinned} />
                  {stock.price_change_pct != null && (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-[family-name:var(--font-geist-mono)] ${stock.price_change_pct >= 0 ? 'bg-[#00D4AA]/10 text-[#00D4AA]' : 'bg-[#FF4D6A]/10 text-[#FF4D6A]'}`}>
                      {stock.price_change_pct > 0 ? '+' : ''}{stock.price_change_pct.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-end justify-between mt-4 pt-4 border-t border-[#1E293B]/50">
                <div className="flex flex-col gap-1.5 w-1/3">
                  <span className="text-[10px] font-bold text-[#8B95A8] uppercase tracking-wider font-[family-name:var(--font-geist-mono)]">Price</span>
                  <span className="text-lg font-black font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">
                    {stock.current_price != null ? `$${stock.current_price.toFixed(2)}` : '—'}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1.5 w-1/3">
                  <span className="text-[10px] font-bold text-[#8B95A8] uppercase tracking-wider font-[family-name:var(--font-geist-mono)]">Aura Score</span>
                  <span className="text-sm font-bold font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">
                    {stock.priority_score.toFixed(3)}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1.5 w-1/3">
                  <span className="text-[10px] font-bold text-[#8B95A8] uppercase tracking-wider font-[family-name:var(--font-geist-mono)]">Sentiment</span>
                  <SentimentBar sentiment={stock.overall_sentiment} />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filteredAndSorted.length === 0 && !loading && (
          <div className="flex-1 flex items-center justify-center py-20">
            <p className="text-[#64748B] font-[family-name:var(--font-geist-mono)]">No assets found matching your criteria.</p>
          </div>
        )}
      </div>
    </main>
  )
}
