'use client'

import { Activity, ArrowLeft, TrendingUp, DollarSign, Briefcase, RefreshCw, Loader2, CheckCircle2, XCircle, Database, Settings, Search } from 'lucide-react'
import Link from 'next/link'
import { getSentimentLabel, getSentimentBadgeClass, PulseBar, ConvictionMini } from '@/components/TickerRow'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [session, setSession] = useState<any>(null)
  const [sortBy, setSortBy] = useState<'weight' | 'sentiment' | 'upside' | 'ticker'>('weight')
  const [hideLowData, setHideLowData] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()

  const fetchPortfolio = useCallback(async (fresh: boolean = false) => {
    const supabase = createClient()
    const { data: { session: sessionData } } = await supabase.auth.getSession()
    
    if (!sessionData) {
      router.push('/admin/login')
      return
    }
    setSession(sessionData)

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      
      const [portRes, stocksRes] = await Promise.all([
        fetch(`${backendUrl}/api/v1/portfolio/`, {
          headers: { 'Authorization': `Bearer ${sessionData.access_token}` }
        }).then(res => res.json()),
        fetch(`${backendUrl}/api/v1/stocks?fresh=${fresh}`).then(res => res.json())
      ])
      
      const portData = portRes.portfolio || []
      const stocksData = stocksRes.stocks || []
      
      const validPortData = portData.filter((p: any) => p.shares > 0)
      
      const merged = validPortData.map((p: any) => {
        const stock = stocksData.find((s: any) => s.ticker === p.ticker)
        return {
          ...p,
          stock_name: stock?.stock_name || null,
          consensus_sentiment: stock?.overall_sentiment || 0,
          avg_target_price: stock?.avg_target_price || null,
          avg_conviction: stock?.avg_conviction || 0,
          mention_count: stock?.mention_count_30d || 0,
          analyst_count: stock?.analyst_count || 0
        }
      })
      
      setPortfolio(merged)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchPortfolio()
  }, [fetchPortfolio])

  const handleSync = async () => {
    const providerToken = session?.provider_token || (typeof window !== 'undefined' ? localStorage.getItem('google_provider_token') : null)
    
    if (!providerToken) {
      alert('No Google Sheets access found. Please sign out and sign back in to grant permission.')
      return
    }
    setSyncStatus('loading')
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const res = await fetch(`${backendUrl}/api/v1/portfolio/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ provider_token: providerToken })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to sync portfolio')
      
      setSyncStatus('success')
      await fetchPortfolio(true) // refresh data and bust backend cache!
      setTimeout(() => setSyncStatus('idle'), 3000)
    } catch (err: any) {
      console.error(err)
      alert(`Sync Failed: ${err.message}`)
      setSyncStatus('error')
      setTimeout(() => setSyncStatus('idle'), 3000)
    }
  }

  // Calculate analytics
  const totalHoldings = portfolio.length
  const totalInvested = portfolio.reduce((acc, p) => acc + (p.shares * p.average_cost), 0)
  const totalTargetValue = portfolio.reduce((acc, p) => acc + (p.shares * (p.avg_target_price || p.average_cost)), 0)
  const totalUpside = totalTargetValue - totalInvested
  const totalUpsidePercent = totalInvested > 0 ? (totalUpside / totalInvested) * 100 : 0
  const avgSentiment = totalHoldings > 0 ? portfolio.reduce((acc, p) => acc + p.consensus_sentiment, 0) / totalHoldings : 0
  const avgConviction = totalHoldings > 0 ? portfolio.reduce((acc, p) => acc + p.avg_conviction, 0) / totalHoldings : 0

  const largestHolding = portfolio.length > 0 ? portfolio.reduce((prev, current) => (prev.shares * prev.average_cost > current.shares * current.average_cost) ? prev : current) : null;
  const highestUpside = portfolio.length > 0 ? portfolio.reduce((prev, current) => {
    const prevUpside = prev.avg_target_price ? (prev.avg_target_price - prev.average_cost) / prev.average_cost : -9999;
    const currentUpside = current.avg_target_price ? (current.avg_target_price - current.average_cost) / current.average_cost : -9999;
    return (prevUpside > currentUpside) ? prev : current;
  }) : null;

  const sortedPortfolio = useMemo(() => {
    let filtered = portfolio
    if (hideLowData) {
      filtered = filtered.filter(p => p.mention_count >= 3)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(p => 
        p.ticker.toLowerCase().includes(q) || 
        (p.stock_name && p.stock_name.toLowerCase().includes(q))
      )
    }

    return [...filtered].sort((a, b) => {
      const aValue = a.shares * a.average_cost
      const bValue = b.shares * b.average_cost
      
      const aUpside = a.avg_target_price ? ((a.avg_target_price - a.average_cost) / a.average_cost) : -9999
      const bUpside = b.avg_target_price ? ((b.avg_target_price - b.average_cost) / b.average_cost) : -9999

      if (sortBy === 'weight') return bValue - aValue
      if (sortBy === 'sentiment') return b.consensus_sentiment - a.consensus_sentiment
      if (sortBy === 'upside') return bUpside - aUpside
      if (sortBy === 'ticker') return a.ticker.localeCompare(b.ticker)
      return 0
    })
  }, [portfolio, sortBy, hideLowData, searchQuery])

  return (
    <div className="min-h-screen bg-[#0A0F1A] p-4 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-up">
        <div className="bg-[#141B2D]/60 border border-[#1E293B] p-8 rounded-3xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#00D4AA]/5 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="relative z-10">
            <h1 className="text-3xl md:text-4xl font-bold text-[#F1F5F9] mb-3 flex items-center gap-4">
              <div className="p-3 bg-[#00D4AA]/10 rounded-xl border border-[#00D4AA]/20 text-[#00D4AA]">
                <TrendingUp className="h-6 w-6" />
              </div>
              <span>My Portfolio</span>
              {session && (
                <Link
                  href="/admin"
                  title="Admin Settings"
                  className="p-1.5 text-[#64748B] hover:text-[#00D4AA] hover:bg-[#1E293B]/50 rounded-lg transition-all ml-1"
                >
                  <Settings className="h-5 w-5" />
                </Link>
              )}
            </h1>
            <p className="text-[#8B95A8] text-lg max-w-2xl">
              Track real-time market conviction for the stocks you own. Data synced directly from your Google Sheet.
            </p>
          </div>

          <button
            onClick={handleSync}
            disabled={syncStatus === 'loading' || syncStatus === 'success'}
            className={`relative z-10 group flex items-center gap-3 rounded-xl border px-5 py-3 transition-all duration-200 overflow-hidden shrink-0 ${
              syncStatus === 'success' ? 'bg-[#00D4AA]/10 border-[#00D4AA]/20 text-[#00D4AA]' :
              syncStatus === 'error' ? 'bg-[#FF4D6A]/10 border-[#FF4D6A]/20 text-[#FF4D6A]' :
              'bg-[#141B2D] border-[#1E293B] hover:border-[#00D4AA]/30 text-[#F1F5F9] hover:bg-[#1E293B]'
            }`}
          >
            <div className="flex shrink-0 items-center justify-center">
              {syncStatus === 'loading' && <Loader2 className="h-4.5 w-4.5 animate-spin text-[#00D4AA]" />}
              {syncStatus === 'success' && <CheckCircle2 className="h-4.5 w-4.5" />}
              {syncStatus === 'error' && <XCircle className="h-4.5 w-4.5" />}
              {syncStatus === 'idle' && <Database className="h-4.5 w-4.5 text-[#00D4AA] group-hover:scale-110 transition-transform" />}
            </div>
            <span className="font-medium text-sm">
              {syncStatus === 'loading' ? 'Syncing...' :
               syncStatus === 'success' ? 'Synced!' :
               syncStatus === 'error' ? 'Failed' :
               'Sync Google Sheet'}
            </span>
          </button>
        </div>

        {/* Analytics Header */}
        {!loading && totalHoldings > 0 && (
          <div className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2 font-[family-name:var(--font-geist-mono)]">Portfolio Overview</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Financial Capitalization & Performance Card */}
              <div className="bg-[#141B2D]/40 border border-[#1E293B] p-6 rounded-2xl flex flex-col justify-between gap-4 lg:col-span-2 relative overflow-hidden group hover:border-[#3B82F6]/30 transition-colors">
                <div className="absolute top-0 right-0 w-48 h-48 bg-[#00D4AA]/5 blur-3xl rounded-full pointer-events-none group-hover:bg-[#00D4AA]/10 transition-colors" />
                
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-[#00D4AA]" />
                  <span className="text-xs text-[#64748B] font-medium uppercase tracking-wider">Portfolio Capitalization</span>
                </div>
                
                <div className="flex flex-col md:flex-row justify-between gap-6 md:items-end">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-[10px] text-[#64748B] uppercase tracking-wider">Total Invested</p>
                        <p className="text-2xl font-bold font-[family-name:var(--font-geist-mono)] text-[#F1F5F9] mt-0.5">
                          ${totalInvested.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#64748B] uppercase tracking-wider">Implied Target Value</p>
                        <p className="text-2xl font-bold font-[family-name:var(--font-geist-mono)] text-[#F1F5F9] mt-0.5">
                          ${totalTargetValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-start md:items-end border-t md:border-t-0 md:border-l border-[#1E293B] pt-4 md:pt-0 md:pl-6 shrink-0">
                    <span className="text-[10px] text-[#64748B] uppercase tracking-wider font-semibold">Implied Analyst Return</span>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className={`text-4xl md:text-5xl font-black font-[family-name:var(--font-geist-mono)] leading-none bg-clip-text text-transparent ${totalUpside >= 0 ? 'bg-gradient-to-r from-[#00D4AA] to-[#3B82F6]' : 'bg-gradient-to-r from-[#FF4D6A] to-[#F97316]'}`}>
                        {totalUpside >= 0 ? '+' : ''}${totalUpside.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <span className={`text-sm font-bold font-[family-name:var(--font-geist-mono)] mt-2 inline-flex px-2 py-0.5 rounded-md ${totalUpside >= 0 ? 'bg-[#00D4AA]/10 text-[#00D4AA]' : 'bg-[#FF4D6A]/10 text-[#FF4D6A]'}`}>
                      {totalUpside >= 0 ? '+' : ''}{totalUpsidePercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Signal Strength & Conviction Card */}
              <div className="bg-[#141B2D]/40 border border-[#1E293B] p-6 rounded-2xl flex flex-col justify-between space-y-4 relative overflow-hidden group hover:border-[#3B82F6]/30 transition-colors">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#3B82F6]/5 blur-2xl rounded-full pointer-events-none group-hover:bg-[#3B82F6]/10 transition-colors" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#64748B] font-medium uppercase tracking-wider">Portfolio Conviction</span>
                  <Activity className="h-4.5 w-4.5 text-[#8B95A8]/50" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-[#64748B] uppercase tracking-wider">Avg Sentiment</p>
                    <div className="flex items-baseline gap-0.5 mt-1">
                      <span className={`text-3xl font-bold font-[family-name:var(--font-geist-mono)] ${
                        avgSentiment >= 1 ? 'text-[#00D4AA]' : 
                        avgSentiment <= -1 ? 'text-[#FF4D6A]' : 
                        'text-[#8B95A8]'
                      }`}>
                        {avgSentiment > 0 ? '+' : ''}{avgSentiment.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-[10px] text-[#64748B] uppercase tracking-wider">Avg Conviction</p>
                    <div className="flex items-baseline gap-0.5 mt-1">
                      <span className="text-3xl font-bold font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">{avgConviction.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Insights */}
              <div className="bg-[#141B2D]/40 border border-[#1E293B] p-6 rounded-2xl flex flex-col justify-between space-y-4 relative overflow-hidden group hover:border-[#00D4AA]/30 transition-colors">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#00D4AA]/5 blur-2xl rounded-full pointer-events-none group-hover:bg-[#00D4AA]/10 transition-colors" />
                
                {/* Highest Upside */}
                {highestUpside && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-[#64748B] uppercase tracking-wider font-semibold">Highest Upside Pick</span>
                    <div className="flex items-center justify-between mt-1 relative z-10">
                      <span className="text-3xl font-black font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">{highestUpside.ticker}</span>
                      <span className="text-xl font-black font-[family-name:var(--font-geist-mono)] bg-clip-text text-transparent bg-gradient-to-r from-[#00D4AA] to-[#3B82F6]">
                        +{highestUpside.avg_target_price ? (((highestUpside.avg_target_price - highestUpside.average_cost) / highestUpside.average_cost) * 100).toFixed(0) : 0}%
                      </span>
                    </div>
                  </div>
                )}

                <div className="w-full h-px bg-[#1E293B] my-2" />

                {/* Largest Holding */}
                {largestHolding && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-[#64748B] uppercase tracking-wider font-semibold">Largest Holding</span>
                    <div className="flex items-center justify-between mt-1 relative z-10">
                      <span className="text-3xl font-black font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">{largestHolding.ticker}</span>
                      <div className="flex flex-col items-end">
                        <span className="text-lg font-bold font-[family-name:var(--font-geist-mono)] text-[#8B95A8]">
                          ${(largestHolding.shares * largestHolding.average_cost).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                        <span className="text-[10px] font-bold font-[family-name:var(--font-geist-mono)] text-[#00D4AA] bg-[#00D4AA]/10 px-1.5 py-0.5 rounded mt-0.5">
                          {(((largestHolding.shares * largestHolding.average_cost) / totalInvested) * 100).toFixed(1)}% Alloc
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sort Controls */}
        {!loading && portfolio.length > 0 && (
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-[#141B2D]/20 border border-[#1E293B] px-6 py-4 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
              <span className="text-xs text-[#8B95A8] font-medium font-[family-name:var(--font-geist-mono)] whitespace-nowrap">
                Showing {sortedPortfolio.length} holdings
              </span>
              
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
                <input
                  type="text"
                  placeholder="Search ticker or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0A0F1A]/50 border border-[#1E293B] rounded-lg pl-9 pr-4 py-1.5 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#00D4AA]/50 focus:ring-1 focus:ring-[#00D4AA]/50 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setHideLowData(!hideLowData)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide border transition-all mr-2 ${
                  hideLowData
                    ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B] shadow-sm'
                    : 'bg-transparent border-[#1E293B] text-[#64748B] hover:text-[#8B95A8] hover:border-[#2D3A4F]'
                }`}
              >
                Hide Low Data
              </button>
              <div className="w-px h-4 bg-[#1E293B] mx-1 hidden sm:block"></div>
              <span className="text-xs text-[#64748B] ml-1 mr-1.5 font-medium">Sort by:</span>
              <button
                onClick={() => setSortBy('weight')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide border transition-all ${
                  sortBy === 'weight'
                    ? 'bg-[#00D4AA]/10 border-[#00D4AA]/30 text-[#00D4AA] shadow-sm'
                    : 'bg-transparent border-[#1E293B] text-[#64748B] hover:text-[#8B95A8] hover:border-[#2D3A4F]'
                }`}
              >
                Portfolio Weight
              </button>
              <button
                onClick={() => setSortBy('sentiment')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide border transition-all ${
                  sortBy === 'sentiment'
                    ? 'bg-[#00D4AA]/10 border-[#00D4AA]/30 text-[#00D4AA] shadow-sm'
                    : 'bg-transparent border-[#1E293B] text-[#64748B] hover:text-[#8B95A8] hover:border-[#2D3A4F]'
                }`}
              >
                Sentiment Score
              </button>
              <button
                onClick={() => setSortBy('upside')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide border transition-all ${
                  sortBy === 'upside'
                    ? 'bg-[#00D4AA]/10 border-[#00D4AA]/30 text-[#00D4AA] shadow-sm'
                    : 'bg-transparent border-[#1E293B] text-[#64748B] hover:text-[#8B95A8] hover:border-[#2D3A4F]'
                }`}
              >
                Implied Upside
              </button>
              <button
                onClick={() => setSortBy('ticker')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide border transition-all ${
                  sortBy === 'ticker'
                    ? 'bg-[#00D4AA]/10 border-[#00D4AA]/30 text-[#00D4AA] shadow-sm'
                    : 'bg-transparent border-[#1E293B] text-[#64748B] hover:text-[#8B95A8] hover:border-[#2D3A4F]'
                }`}
              >
                Symbol
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 text-[#64748B] space-y-4">
            <Activity className="h-8 w-8 animate-spin text-[#00D4AA]" />
            <p className="text-sm font-[family-name:var(--font-geist-mono)] animate-pulse">Loading holdings...</p>
          </div>
        ) : portfolio.length === 0 ? (
          <div className="p-12 border border-[#1E293B] rounded-3xl bg-[#141B2D]/40 text-center">
            <p className="text-[#8B95A8] text-lg">No holdings found.</p>
            <p className="text-[#64748B] mt-2">Go back to the Admin Hub and click "Sync Portfolio" to fetch your latest data.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {sortedPortfolio.map((p, index) => {
              const direction = p.consensus_sentiment >= 0.5 ? 'BUY' : p.consensus_sentiment <= -0.5 ? 'SELL' : 'NEUTRAL'
              const borderGlowClass = direction === 'BUY' 
                ? 'border-l-[#00D4AA] group-hover:shadow-[-4px_0_15px_-3px_rgba(0,212,170,0.3)]' 
                : direction === 'SELL' 
                  ? 'border-l-[#FF4D6A] group-hover:shadow-[-4px_0_15px_-3px_rgba(255,77,106,0.3)]'
                  : 'border-l-[#CBD5E1] group-hover:shadow-[-4px_0_15px_-3px_rgba(203,213,225,0.3)]'
              const textHoverClass = direction === 'BUY' ? 'group-hover:text-[#00D4AA]' : direction === 'SELL' ? 'group-hover:text-[#FF4D6A]' : 'group-hover:text-[#CBD5E1]'
              const isLowConfidence = p.mention_count < 3
              
              const positionValue = p.shares * p.average_cost
              const weightPercent = totalInvested > 0 ? (positionValue / totalInvested) * 100 : 0
              
              const positionUpside = p.avg_target_price ? (p.avg_target_price - p.average_cost) * p.shares : 0
              const positionUpsidePercent = p.avg_target_price ? ((p.avg_target_price - p.average_cost) / p.average_cost) * 100 : 0

              return (
                <Link
                  href={`/ticker?s=${p.ticker}`}
                  key={p.ticker} 
                  className="group block relative w-full rounded-3xl bg-[#141B2D]/40 hover:bg-[#1E293B]/60 border border-[#1E293B]/50 transition-all duration-500 overflow-hidden backdrop-blur-xl"
                >
                  {/* Outer glow aura on hover based on direction */}
                  <div className={`absolute top-0 right-0 w-[400px] h-[400px] blur-[100px] rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700 ${
                    direction === 'BUY' ? 'bg-[#00D4AA]/5' : direction === 'SELL' ? 'bg-[#FF4D6A]/5' : 'bg-white/5'
                  }`} />
                  
                  {/* Left Color Bar Accent */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-300 ${
                    direction === 'BUY' ? 'bg-[#00D4AA] group-hover:shadow-[0_0_20px_rgba(0,212,170,0.4)]' : 
                    direction === 'SELL' ? 'bg-[#FF4D6A] group-hover:shadow-[0_0_20px_rgba(255,77,106,0.4)]' : 
                    'bg-[#8B95A8] group-hover:shadow-[0_0_20px_rgba(139,149,168,0.4)]'
                  }`} />

                  <div className="p-6 md:p-8 pl-8 md:pl-10 relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 md:gap-4">
                    
                    {/* 1. TICKER & SENTIMENT (The BIG HERO) */}
                    <div className="flex flex-col gap-3 w-full md:w-1/4">
                      <div className="flex items-center gap-3">
                        <span className={`font-[family-name:var(--font-geist-mono)] text-5xl md:text-6xl font-black tracking-tighter text-[#F1F5F9] ${textHoverClass} transition-colors`}>
                          {p.ticker}
                        </span>
                        {isLowConfidence && (
                          <span className="px-2 py-1 bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[#F59E0B] text-[10px] font-bold uppercase tracking-widest rounded-lg">
                            Low Data
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-2 mt-2">
                        <div className="flex items-center gap-2">
                          <span className={getSentimentBadgeClass(p.consensus_sentiment)}>
                            {getSentimentLabel(p.consensus_sentiment)}
                          </span>
                          <span className="font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[#F1F5F9]">
                            {p.consensus_sentiment > 0 ? '+' : ''}{p.consensus_sentiment.toFixed(2)}
                          </span>
                        </div>
                        <div className="w-full max-w-[200px]">
                          <PulseBar value={p.consensus_sentiment} isTop={false} />
                        </div>
                      </div>
                    </div>

                    {/* 2. HOLDING VALUE (Huge Numbers) */}
                    <div className="flex flex-col w-full md:w-1/4">
                      <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold mb-1">My Holding</span>
                      <span className="font-[family-name:var(--font-geist-mono)] text-4xl font-black text-[#F1F5F9]">
                        ${positionValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                      <div className="flex items-center gap-2 mt-2 text-xs font-[family-name:var(--font-geist-mono)] text-[#8B95A8]">
                        <span className="font-bold text-[#F1F5F9]">{p.shares}</span> shs <span className="text-[#334155]">@</span> ${p.average_cost} avg
                      </div>
                      <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-[#00D4AA]/10 border border-[#00D4AA]/20 rounded-xl w-fit">
                        <span className="w-2 h-2 rounded-full bg-[#00D4AA] animate-pulse"></span>
                        <span className="text-lg font-black font-[family-name:var(--font-geist-mono)] text-[#00D4AA]">{weightPercent.toFixed(1)}%</span>
                        <span className="text-[10px] text-[#00D4AA]/80 uppercase tracking-widest font-bold">Alloc</span>
                      </div>
                    </div>

                    {/* 3. ANALYST UPSIDE (Huge Numbers) */}
                    <div className="flex flex-col w-full md:w-1/4">
                      <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold mb-1">Analyst Target</span>
                      {p.avg_target_price ? (
                        <>
                          <div className="flex items-baseline gap-2">
                            <span className="font-[family-name:var(--font-geist-mono)] text-4xl font-black text-[#F1F5F9]">
                              ${Math.round(p.avg_target_price)}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1 mt-2">
                            <span className={`text-lg font-black font-[family-name:var(--font-geist-mono)] ${positionUpside >= 0 ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'}`}>
                              {positionUpside >= 0 ? '+' : ''}{positionUpsidePercent.toFixed(1)}% Upside
                            </span>
                            <span className={`text-xs font-bold font-[family-name:var(--font-geist-mono)] ${positionUpside >= 0 ? 'text-[#00D4AA]/70' : 'text-[#FF4D6A]/70'}`}>
                              ({positionUpside >= 0 ? '+' : ''}${Math.round(positionUpside).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center h-full">
                          <span className="font-[family-name:var(--font-geist-mono)] text-2xl text-[#475569] font-medium">N/A</span>
                        </div>
                      )}
                    </div>

                    {/* 4. CONVICTION STATS */}
                    <div className="flex flex-col w-full md:w-[15%]">
                      <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold mb-3">Signal Strength</span>
                      <ConvictionMini level={p.avg_conviction} />
                      <div className="flex flex-col gap-1 text-[11px] text-[#8B95A8] mt-3 font-medium">
                        <div className="flex items-center justify-between">
                          <span>Recommendations</span>
                          <span className="font-[family-name:var(--font-geist-mono)] font-bold text-[#F1F5F9]">{p.mention_count}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Analyst Sources</span>
                          <span className="font-[family-name:var(--font-geist-mono)] font-bold text-[#F1F5F9]">{p.analyst_count}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Chevron for Desktop */}
                    <div className={`hidden md:flex text-[#64748B] ${textHoverClass} transition-all transform group-hover:translate-x-2`}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </div>

                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
