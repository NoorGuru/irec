'use client'

import { Activity, ArrowLeft, TrendingUp, DollarSign, Briefcase, RefreshCw, Loader2, CheckCircle2, XCircle, Database, Settings } from 'lucide-react'
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
  const router = useRouter()

  const fetchPortfolio = useCallback(async () => {
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
        fetch(`${backendUrl}/api/v1/stocks`).then(res => res.json())
      ])
      
      const portData = portRes.portfolio || []
      const stocksData = stocksRes.stocks || []
      
      const merged = portData.map((p: any) => {
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
    if (!session?.provider_token) {
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
        body: JSON.stringify({ provider_token: session.provider_token })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to sync portfolio')
      
      setSyncStatus('success')
      await fetchPortfolio() // refresh data!
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

  const sortedPortfolio = useMemo(() => {
    return [...portfolio].sort((a, b) => {
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
  }, [portfolio, sortBy])

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
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Capital Allocation Card */}
              <div className="bg-[#141B2D]/40 border border-[#1E293B] p-6 rounded-2xl flex flex-col justify-between space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#00D4AA]/5 blur-2xl rounded-full pointer-events-none" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#64748B] font-medium uppercase tracking-wider">Portfolio Capitalization</span>
                  <DollarSign className="h-4.5 w-4.5 text-[#8B95A8]/50" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-[#64748B] uppercase tracking-wider">Total Invested</p>
                    <p className="text-xl font-bold font-[family-name:var(--font-geist-mono)] text-[#F1F5F9] mt-0.5">
                      ${totalInvested.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#00D4AA] uppercase tracking-wider">Implied Target</p>
                    <p className="text-xl font-bold font-[family-name:var(--font-geist-mono)] text-[#00D4AA] mt-0.5">
                      ${totalTargetValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Upside Card */}
              <div className="bg-[#141B2D]/40 border border-[#1E293B] p-6 rounded-2xl flex flex-col justify-between space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#00FFD0]/5 blur-2xl rounded-full pointer-events-none" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#64748B] font-medium uppercase tracking-wider">Consensus Target Profit</span>
                  <TrendingUp className="h-4.5 w-4.5 text-[#8B95A8]/50" />
                </div>
                <div>
                  <p className="text-[10px] text-[#64748B] uppercase tracking-wider">Implied Return</p>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className={`text-2xl font-black font-[family-name:var(--font-geist-mono)] ${totalUpside >= 0 ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'}`}>
                      {totalUpside >= 0 ? '+' : ''}${totalUpside.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    <span className={`text-sm font-bold font-[family-name:var(--font-geist-mono)] ${totalUpside >= 0 ? 'text-[#00D4AA]/80' : 'text-[#FF4D6A]/80'}`}>
                      ({totalUpside >= 0 ? '+' : ''}{totalUpsidePercent.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Signal Strength Card */}
              <div className="bg-[#141B2D]/40 border border-[#1E293B] p-6 rounded-2xl flex flex-col justify-between space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#3B82F6]/5 blur-2xl rounded-full pointer-events-none" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#64748B] font-medium uppercase tracking-wider">Community Sentiment</span>
                  <Activity className="h-4.5 w-4.5 text-[#8B95A8]/50" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-[#64748B] uppercase tracking-wider">Avg Sentiment</p>
                    <div className="flex items-baseline gap-0.5 mt-0.5">
                      <span className={`text-xl font-bold font-[family-name:var(--font-geist-mono)] ${
                        avgSentiment >= 1 ? 'text-[#00D4AA]' : 
                        avgSentiment <= -1 ? 'text-[#FF4D6A]' : 
                        'text-[#8B95A8]'
                      }`}>
                        {avgSentiment > 0 ? '+' : ''}{avgSentiment.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-[#475569]">/2.0</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#64748B] uppercase tracking-wider">Avg Conviction</p>
                    <div className="flex items-baseline gap-0.5 mt-0.5">
                      <span className="text-xl font-bold font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">{avgConviction.toFixed(1)}</span>
                      <span className="text-[10px] text-[#475569]">/10</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sort Controls */}
        {!loading && portfolio.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#141B2D]/20 border border-[#1E293B] px-6 py-3.5 rounded-2xl">
            <span className="text-xs text-[#8B95A8] font-medium font-[family-name:var(--font-geist-mono)]">
              Showing {portfolio.length} holdings
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-[#64748B] mr-1.5 font-medium">Sort by:</span>
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
                  : 'border-l-[#8B95A8] group-hover:shadow-[-4px_0_15px_-3px_rgba(139,149,168,0.3)]'
              const textHoverClass = direction === 'BUY' ? 'group-hover:text-[#00D4AA]' : direction === 'SELL' ? 'group-hover:text-[#FF4D6A]' : 'group-hover:text-[#8B95A8]'
              const isLowConfidence = p.mention_count < 3
              
              const positionValue = p.shares * p.average_cost
              const weightPercent = totalInvested > 0 ? (positionValue / totalInvested) * 100 : 0
              
              const positionUpside = p.avg_target_price ? (p.avg_target_price - p.average_cost) * p.shares : 0
              const positionUpsidePercent = p.avg_target_price ? ((p.avg_target_price - p.average_cost) / p.average_cost) * 100 : 0

              return (
                <Link
                  href={`/ticker?s=${p.ticker}`}
                  key={p.ticker} 
                  className={`group block relative w-full rounded-r-xl rounded-l-sm bg-[#141B2D]/40 hover:bg-[#1E293B]/40 border border-transparent border-l-4 ${borderGlowClass} transition-all duration-300 ${isLowConfidence ? 'opacity-70 hover:opacity-100' : ''}`}
                >
                  <div className="absolute inset-0 rounded-r-xl border-y border-r border-[#1E293B]/50 pointer-events-none transition-colors group-hover:border-white/5" />
                  
                  {/* Mobile Layout */}
                  <div className="p-5 w-full md:hidden flex flex-col gap-4 relative z-10">
                    {/* Row 1: Ticker Info & Weight */}
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className={`font-[family-name:var(--font-geist-mono)] text-xl font-bold tracking-wide text-[#F1F5F9] ${textHoverClass} transition-colors`}>
                            {p.ticker}
                          </span>
                          {isLowConfidence && (
                            <span className="text-[8px] text-[#F59E0B]/70 bg-[#F59E0B]/5 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">low data</span>
                          )}
                        </div>
                        {p.stock_name && (
                          <span className="text-[11px] text-[#64748B] truncate max-w-[200px] mt-0.5">{p.stock_name}</span>
                        )}
                      </div>
                      
                      <div className="text-right flex flex-col items-end">
                        <span className="text-[10px] uppercase tracking-wider text-[#64748B] font-semibold">Allocation</span>
                        <span className="font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[#00D4AA]">
                          {weightPercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Row 2: Sentiment Pulse */}
                    <div className="bg-[#0A0F1A]/30 border border-[#1E293B]/40 p-3.5 rounded-xl flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] uppercase tracking-wider text-[#64748B] font-semibold">Consensus Sentiment</span>
                        <div className="flex items-center gap-2">
                          <span className={getSentimentBadgeClass(p.consensus_sentiment)}>
                            {getSentimentLabel(p.consensus_sentiment)}
                          </span>
                          <span className="font-[family-name:var(--font-geist-mono)] text-xs font-bold text-[#F1F5F9]">
                            {p.consensus_sentiment > 0 ? '+' : ''}{p.consensus_sentiment.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <PulseBar value={p.consensus_sentiment} isTop={false} />
                    </div>

                    {/* Row 3: Grid of holding & investment stats */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* My Holding */}
                      <div className="bg-[#0A0F1A]/30 border border-[#1E293B]/40 p-3 rounded-xl flex flex-col justify-between min-h-[70px]">
                        <span className="text-[9px] text-[#64748B] uppercase tracking-wider font-semibold">My Holding</span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="font-[family-name:var(--font-geist-mono)] text-base font-bold text-[#F1F5F9]">{p.shares}</span>
                          <span className="text-[10px] text-[#64748B]">shares</span>
                        </div>
                        <span className="text-[10px] font-[family-name:var(--font-geist-mono)] text-[#8B95A8] mt-0.5">
                          Avg: ${p.average_cost}
                        </span>
                      </div>

                      {/* Invested Value */}
                      <div className="bg-[#0A0F1A]/30 border border-[#1E293B]/40 p-3 rounded-xl flex flex-col justify-between min-h-[70px]">
                        <span className="text-[9px] text-[#64748B] uppercase tracking-wider font-semibold">Invested Value</span>
                        <span className="font-[family-name:var(--font-geist-mono)] text-base font-bold text-[#F1F5F9] mt-1">
                          ${positionValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                        <span className="text-[9px] text-[#64748B]">At Cost</span>
                      </div>

                      {/* Conviction */}
                      <div className="bg-[#0A0F1A]/30 border border-[#1E293B]/40 p-3 rounded-xl flex flex-col justify-between min-h-[70px]">
                        <span className="text-[9px] text-[#64748B] uppercase tracking-wider font-semibold">Conviction Strength</span>
                        <div className="mt-1">
                          <ConvictionMini level={p.avg_conviction} />
                        </div>
                        <div className="flex items-center gap-1 text-[9px] text-[#8B95A8] mt-1">
                          <span className="font-[family-name:var(--font-geist-mono)] font-bold text-[#F1F5F9]">{p.mention_count}</span>
                          <span>recs ({p.analyst_count} sources)</span>
                        </div>
                      </div>

                      {/* Analyst Target */}
                      <div className="bg-[#0A0F1A]/30 border border-[#1E293B]/40 p-3 rounded-xl flex flex-col justify-between min-h-[70px]">
                        <span className="text-[9px] text-[#64748B] uppercase tracking-wider font-semibold">Analyst Target</span>
                        {p.avg_target_price ? (
                          <div className="mt-1">
                            <div className="flex items-center gap-1">
                              <span className="font-[family-name:var(--font-geist-mono)] text-base font-bold text-[#00D4AA]">
                                ${Math.round(p.avg_target_price)}
                              </span>
                              <span className={`text-[10px] font-bold font-[family-name:var(--font-geist-mono)] ${positionUpside >= 0 ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'}`}>
                                ({positionUpside >= 0 ? '+' : ''}{positionUpsidePercent.toFixed(0)}%)
                              </span>
                            </div>
                            <span className={`text-[9px] font-[family-name:var(--font-geist-mono)] block truncate mt-0.5 ${positionUpside >= 0 ? 'text-[#00D4AA]/80' : 'text-[#FF4D6A]/80'}`}>
                              {positionUpside >= 0 ? '+' : ''}${Math.round(positionUpside).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        ) : (
                          <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[#475569] font-medium mt-1">No target</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Desktop Layout */}
                  <div className="hidden md:grid p-6 w-full md:grid-cols-[1.2fr_1.8fr_1.2fr_1.5fr_1.2fr_1.8fr_auto] items-center gap-6 relative z-10">
                    
                    {/* Ticker & Name & Weight */}
                    <div className="flex flex-col justify-center min-w-0">
                      <div className="flex items-baseline gap-2.5 overflow-hidden">
                        <span className={`font-[family-name:var(--font-geist-mono)] text-xl md:text-2xl font-bold tracking-wide text-[#F1F5F9] ${textHoverClass} transition-colors`}>
                          {p.ticker}
                        </span>
                        {isLowConfidence && (
                          <span className="inline-flex items-center text-[8px] text-[#F59E0B]/70 bg-[#F59E0B]/5 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">low data</span>
                        )}
                      </div>
                      {p.stock_name && (
                        <span className="text-[10px] text-[#64748B] truncate mt-0.5">{p.stock_name}</span>
                      )}
                      <span className="text-[10px] font-bold font-[family-name:var(--font-geist-mono)] text-[#00D4AA]/80 mt-1">
                        Weight: {weightPercent.toFixed(1)}%
                      </span>
                    </div>

                    {/* Aura Sentiment */}
                    <div className="flex flex-col justify-center w-full">
                      <div className="flex justify-between items-end mb-1">
                        <span className={getSentimentBadgeClass(p.consensus_sentiment)}>
                          {getSentimentLabel(p.consensus_sentiment)}
                        </span>
                        <span className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[#64748B]">
                          {p.consensus_sentiment > 0 ? '+' : ''}{p.consensus_sentiment.toFixed(2)}
                        </span>
                      </div>
                      <PulseBar value={p.consensus_sentiment} isTop={false} />
                    </div>

                    {/* Aura Stats */}
                    <div className="flex flex-col justify-center gap-1 border-l border-[#1E293B]/60 pl-4 h-full">
                      <span className="text-[9px] text-[#64748B] uppercase tracking-wider font-semibold">Conviction</span>
                      <ConvictionMini level={p.avg_conviction} />
                      <div className="flex items-center gap-1 text-[9px] text-[#8B95A8] mt-0.5">
                        <span className="font-[family-name:var(--font-geist-mono)] font-semibold text-[#F1F5F9]">{p.mention_count}</span>
                        <span>recs</span>
                        <span className="mx-0.5">•</span>
                        <span className="font-[family-name:var(--font-geist-mono)] font-semibold text-[#F1F5F9]">{p.analyst_count}</span>
                        <span>sources</span>
                      </div>
                    </div>

                    {/* Personal Holdings */}
                    <div className="flex flex-col gap-1 border-l border-[#1E293B]/60 pl-4 h-full justify-center">
                      <span className="text-[9px] text-[#64748B] uppercase tracking-wider font-semibold">My Holding</span>
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-[#8B95A8]/50" />
                        <span className="font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[#F1F5F9]">{p.shares}</span>
                        <span className="text-[10px] text-[#64748B] font-medium">shares</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-[#8B95A8]/50" />
                        <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[#8B95A8]">Avg cost:</span>
                        <span className="font-[family-name:var(--font-geist-mono)] text-xs font-bold text-[#F1F5F9]">
                          ${p.average_cost}
                        </span>
                      </div>
                    </div>

                    {/* Capital Invested */}
                    <div className="flex flex-col gap-1 border-l border-[#1E293B]/60 pl-4 h-full justify-center">
                      <span className="text-[9px] text-[#64748B] uppercase tracking-wider font-semibold">Invested Value</span>
                      <span className="font-[family-name:var(--font-geist-mono)] text-lg font-bold text-[#F1F5F9]">
                        ${positionValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-[9px] text-[#64748B] uppercase tracking-wider">At Cost Basis</span>
                    </div>

                    {/* Analyst Target & Upside */}
                    <div className="flex flex-col gap-1 border-l border-[#1E293B]/60 pl-4 h-full justify-center">
                      <span className="text-[9px] text-[#64748B] uppercase tracking-wider font-semibold">Consensus Target</span>
                      {p.avg_target_price ? (
                        <>
                          <div className="flex items-center gap-1">
                            <span className="font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[#00D4AA]">
                              ${Math.round(p.avg_target_price)}
                            </span>
                            <span className={`text-[10px] font-bold font-[family-name:var(--font-geist-mono)] ${positionUpside >= 0 ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'}`}>
                              ({positionUpside >= 0 ? '+' : ''}{positionUpsidePercent.toFixed(1)}%)
                            </span>
                          </div>
                          <span className={`text-[9px] font-[family-name:var(--font-geist-mono)] font-semibold ${positionUpside >= 0 ? 'text-[#00D4AA]/80' : 'text-[#FF4D6A]/80'}`}>
                            {positionUpside >= 0 ? '+' : ''}${Math.round(positionUpside).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} value
                          </span>
                        </>
                      ) : (
                        <span className="font-[family-name:var(--font-geist-mono)] text-sm text-[#475569] font-medium">No target</span>
                      )}
                    </div>

                    {/* Chevron */}
                    <div className={`hidden md:flex text-[#64748B] ${textHoverClass} transition-colors justify-self-end`}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="transform group-hover:translate-x-1 transition-transform">
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
