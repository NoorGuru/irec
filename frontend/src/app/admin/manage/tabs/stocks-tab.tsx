'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Activity, RefreshCw, Pin, Search } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

interface StockMeta {
  ticker: string
  tier: number
  priority_score: number
  mention_count_30d: number
  analyst_count: number
  is_pinned: boolean
  last_mentioned_at: string | null
  last_price_update: string | null
  created_at: string
}

export function StocksTab() {
  const [data, setData] = useState<StockMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [reranking, setReranking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  async function fetchMeta() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: session } = await supabase.auth.getSession()
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/v1/admin/ingestion/stock-meta`, {
        headers: {
          'Authorization': `Bearer ${session.session?.access_token}`
        }
      })
      if (!res.ok) throw new Error('Failed to fetch stock metadata')
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMeta()
  }, [])

  async function handleTogglePin(ticker: string, currentPin: boolean) {
    try {
      const supabase = createClient()
      const { data: session } = await supabase.auth.getSession()
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/v1/admin/ingestion/stock-meta/${ticker}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_pinned: !currentPin })
      })
      
      if (!res.ok) throw new Error('Failed to update pin status')
      
      // Update local state optimistic UI could be better but refetching is safer
      setData(prev => prev.map(s => s.ticker === ticker ? { ...s, is_pinned: !currentPin } : s))
    } catch (err: any) {
      alert(`Error toggling pin: ${err.message}`)
    }
  }

  async function handleRerank() {
    setReranking(true)
    try {
      const supabase = createClient()
      const { data: session } = await supabase.auth.getSession()
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/v1/admin/ingestion/rerank`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!res.ok) throw new Error('Failed to trigger rerank')
      
      await fetchMeta() // Refresh data
    } catch (err: any) {
      alert(`Error triggering rerank: ${err.message}`)
    } finally {
      setReranking(false)
    }
  }

  const filteredData = data.filter(s => search === '' || s.ticker.toLowerCase().includes(search.toLowerCase()))
  
  const tier1 = filteredData.filter(s => s.tier === 1)
  const tier2 = filteredData.filter(s => s.tier === 2)

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-[#141B2D]/40 border border-[#1E293B] p-4 rounded-xl">
        <div>
          <h2 className="text-xl font-medium text-[#F1F5F9] font-[family-name:var(--font-geist-mono)] tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#00D4AA]" />
            Tier Engine
          </h2>
          <p className="text-sm text-[#8B95A8] mt-1">Manage stock tracking tiers and priority scores.</p>
        </div>
        
        <button
          onClick={handleRerank}
          disabled={reranking}
          className="px-4 py-2 bg-[#00D4AA]/10 hover:bg-[#00D4AA]/20 text-[#00D4AA] border border-[#00D4AA]/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${reranking ? 'animate-spin' : ''}`} />
          {reranking ? 'Reranking...' : 'Rerank Now'}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-[#FF4D6A]/10 border border-[#FF4D6A]/20 text-[#FF4D6A] text-sm">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
        <input 
          type="text"
          placeholder="Search ticker..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-[#141B2D]/50 border border-[#1E293B] rounded-xl pl-10 pr-4 py-2 text-sm text-[#F1F5F9] placeholder:text-[#475569] outline-none focus:border-[#00D4AA]/50 transition-colors"
        />
      </div>

      {/* Data Section */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#00D4AA] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* Tier 1 */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#F1F5F9] tracking-wider uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00D4AA] shadow-[0_0_8px_#00D4AA]"></span>
              Tier 1 (Trending)
              <span className="text-[#8B95A8] bg-[#1E293B] px-2 py-0.5 rounded-full text-xs font-mono">{tier1.length}/50</span>
            </h3>
            
            <div className="rounded-xl border border-[#1E293B] bg-[#0A0F1A]/60 backdrop-blur-md overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-[#1E293B] bg-[#141B2D]/30 text-[#8B95A8] font-mono uppercase tracking-wider text-xs">
                    <th className="px-4 py-3">Ticker</th>
                    <th className="px-4 py-3">Priority Score</th>
                    <th className="px-4 py-3 text-right">Mentions (30d)</th>
                    <th className="px-4 py-3 text-right">Analysts</th>
                    <th className="px-4 py-3">Last Mentioned</th>
                    <th className="px-4 py-3">Last Price Update</th>
                    <th className="px-4 py-3 text-center">Pin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]/50">
                  {tier1.map(s => (
                    <tr key={s.ticker} className={`hover:bg-[#141B2D]/40 transition-colors ${s.is_pinned ? 'bg-[#00D4AA]/5' : ''}`}>
                      <td className="px-4 py-3 font-bold font-mono text-[#F1F5F9]">
                        {s.ticker}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-[#00D4AA]/50 to-[#00D4AA]" style={{ width: `${Math.min(100, s.priority_score * 100)}%` }} />
                          </div>
                          <span className="text-xs text-[#8B95A8] font-mono">{s.priority_score.toFixed(3)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-[#F1F5F9] font-mono">{s.mention_count_30d}</td>
                      <td className="px-4 py-3 text-right text-[#F1F5F9] font-mono">{s.analyst_count}</td>
                      <td className="px-4 py-3 text-[#8B95A8] text-xs">{s.last_mentioned_at ? formatRelativeTime(s.last_mentioned_at) : 'Never'}</td>
                      <td className="px-4 py-3 text-[#8B95A8] text-xs">{s.last_price_update ? formatRelativeTime(s.last_price_update) : 'Never'}</td>
                      <td className="px-4 py-3 text-center">
                        <button 
                          onClick={() => handleTogglePin(s.ticker, s.is_pinned)}
                          className={`p-1.5 rounded-md transition-colors ${s.is_pinned ? 'bg-[#00D4AA]/20 text-[#00D4AA] hover:bg-[#FF4D6A]/20 hover:text-[#FF4D6A]' : 'text-[#64748B] hover:text-[#00D4AA] hover:bg-[#1E293B]'}`}
                          title={s.is_pinned ? "Unpin from Tier 1" : "Pin to Tier 1"}
                        >
                          <Pin className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {tier1.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-[#64748B]">No Tier 1 stocks.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tier 2 */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#F1F5F9] tracking-wider uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#64748B]"></span>
              Tier 2 (Extended)
              <span className="text-[#8B95A8] bg-[#1E293B] px-2 py-0.5 rounded-full text-xs font-mono">{tier2.length}</span>
            </h3>
            
            <div className="rounded-xl border border-[#1E293B] bg-[#0A0F1A]/60 backdrop-blur-md overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-[#1E293B] bg-[#141B2D]/30 text-[#8B95A8] font-mono uppercase tracking-wider text-xs">
                    <th className="px-4 py-3">Ticker</th>
                    <th className="px-4 py-3">Priority Score</th>
                    <th className="px-4 py-3 text-right">Mentions (30d)</th>
                    <th className="px-4 py-3 text-right">Analysts</th>
                    <th className="px-4 py-3">Last Mentioned</th>
                    <th className="px-4 py-3">Last Price Update</th>
                    <th className="px-4 py-3 text-center">Pin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]/50">
                  {tier2.map(s => (
                    <tr key={s.ticker} className="hover:bg-[#141B2D]/40 transition-colors">
                      <td className="px-4 py-3 font-bold font-mono text-[#F1F5F9]">
                        {s.ticker}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-[#64748B]/50 to-[#64748B]" style={{ width: `${Math.min(100, s.priority_score * 100)}%` }} />
                          </div>
                          <span className="text-xs text-[#8B95A8] font-mono">{s.priority_score.toFixed(3)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-[#F1F5F9] font-mono">{s.mention_count_30d}</td>
                      <td className="px-4 py-3 text-right text-[#F1F5F9] font-mono">{s.analyst_count}</td>
                      <td className="px-4 py-3 text-[#8B95A8] text-xs">{s.last_mentioned_at ? formatRelativeTime(s.last_mentioned_at) : 'Never'}</td>
                      <td className="px-4 py-3 text-[#8B95A8] text-xs">{s.last_price_update ? formatRelativeTime(s.last_price_update) : 'Never'}</td>
                      <td className="px-4 py-3 text-center">
                        <button 
                          onClick={() => handleTogglePin(s.ticker, s.is_pinned)}
                          className="p-1.5 rounded-md text-[#64748B] hover:text-[#00D4AA] hover:bg-[#1E293B] transition-colors"
                          title="Pin to Tier 1"
                        >
                          <Pin className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {tier2.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-[#64748B]">No Tier 2 stocks.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
