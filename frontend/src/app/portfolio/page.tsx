'use client'

import { Activity, ArrowLeft, TrendingUp, DollarSign, Briefcase, RefreshCw, Loader2, CheckCircle2, XCircle, Database, Settings } from 'lucide-react'
import Link from 'next/link'
import { getSentimentLabel, getSentimentBadgeClass, PulseBar, ConvictionMini } from '@/components/TickerRow'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [session, setSession] = useState<any>(null)
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
  const avgSentiment = totalHoldings > 0 ? portfolio.reduce((acc, p) => acc + p.consensus_sentiment, 0) / totalHoldings : 0
  const totalMentions = portfolio.reduce((acc, p) => acc + p.mention_count, 0)
  const totalInvested = portfolio.reduce((acc, p) => acc + (p.shares * p.average_cost), 0)

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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#141B2D]/40 border border-[#1E293B] p-5 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs text-[#64748B] font-medium uppercase tracking-wider mb-1">Total Holdings</p>
                <p className="text-2xl font-bold font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">{totalHoldings}</p>
              </div>
              <Briefcase className="h-8 w-8 text-[#8B95A8]/30 hidden sm:block" />
            </div>
            
            <div className="bg-[#141B2D]/40 border border-[#1E293B] p-5 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs text-[#64748B] font-medium uppercase tracking-wider mb-1">Total Invested</p>
                <p className="text-2xl font-bold font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">
                  ${totalInvested.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-[#8B95A8]/30 hidden sm:block" />
            </div>

            <div className="bg-[#141B2D]/40 border border-[#1E293B] p-5 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs text-[#64748B] font-medium uppercase tracking-wider mb-1">Avg Sentiment</p>
                <p className="text-2xl font-bold font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">
                  <span className={
                    avgSentiment >= 1 ? 'text-[#00D4AA]' : 
                    avgSentiment <= -1 ? 'text-[#FF4D6A]' : 
                    'text-[#8B95A8]'
                  }>
                    {avgSentiment > 0 ? '+' : ''}{avgSentiment.toFixed(2)}
                  </span>
                  <span className="text-sm text-[#475569] ml-1 font-normal">/ 2.0</span>
                </p>
              </div>
              <Activity className="h-8 w-8 text-[#8B95A8]/30 hidden sm:block" />
            </div>
            
            <div className="bg-[#141B2D]/40 border border-[#1E293B] p-5 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs text-[#64748B] font-medium uppercase tracking-wider mb-1">Recent Mentions</p>
                <p className="text-2xl font-bold font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">{totalMentions}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-[#8B95A8]/30 hidden sm:block" />
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
            {portfolio.map((p, index) => {
              const direction = p.consensus_sentiment >= 0.5 ? 'BUY' : p.consensus_sentiment <= -0.5 ? 'SELL' : 'NEUTRAL'
              const borderGlowClass = direction === 'BUY' 
                ? 'border-l-[#00D4AA] group-hover:shadow-[-4px_0_15px_-3px_rgba(0,212,170,0.3)]' 
                : direction === 'SELL' 
                  ? 'border-l-[#FF4D6A] group-hover:shadow-[-4px_0_15px_-3px_rgba(255,77,106,0.3)]'
                  : 'border-l-[#8B95A8] group-hover:shadow-[-4px_0_15px_-3px_rgba(139,149,168,0.3)]'
              const textHoverClass = direction === 'BUY' ? 'group-hover:text-[#00D4AA]' : direction === 'SELL' ? 'group-hover:text-[#FF4D6A]' : 'group-hover:text-[#8B95A8]'
              const isLowConfidence = p.mention_count < 3

              return (
                <Link
                  href={`/ticker?s=${p.ticker}`}
                  key={p.ticker} 
                  className={`group block relative w-full rounded-r-xl rounded-l-sm bg-[#141B2D]/40 hover:bg-[#1E293B]/40 border border-transparent border-l-4 ${borderGlowClass} transition-all duration-300 ${isLowConfidence ? 'opacity-70 hover:opacity-100' : ''}`}
                >
                  <div className="absolute inset-0 rounded-r-xl border-y border-r border-[#1E293B]/50 pointer-events-none transition-colors group-hover:border-white/5" />
                  
                  <div className="p-4 md:p-6 w-full flex flex-col md:grid md:grid-cols-[1.5fr_2fr_1.5fr_1.5fr_auto] md:items-center gap-4 md:gap-6 relative z-10">
                    
                    {/* Ticker & Name */}
                    <div className="flex flex-col justify-center min-w-0">
                      <div className="flex items-baseline gap-3 overflow-hidden">
                        <span className={`font-[family-name:var(--font-geist-mono)] text-2xl md:text-3xl font-bold tracking-wide text-[#F1F5F9] ${textHoverClass} transition-colors`}>
                          {p.ticker}
                        </span>
                        {isLowConfidence && (
                          <span className="inline-flex items-center text-[9px] text-[#F59E0B]/70 bg-[#F59E0B]/5 px-1.5 py-0.5 rounded">low data</span>
                        )}
                      </div>
                      {p.stock_name && (
                        <span className="text-xs text-[#64748B] truncate mt-1">{p.stock_name}</span>
                      )}
                    </div>

                    {/* Aura Sentiment */}
                    <div className="flex flex-col justify-center w-full max-w-[200px]">
                      <div className="flex justify-between items-end mb-1">
                        <span className={getSentimentBadgeClass(p.consensus_sentiment)}>
                          {getSentimentLabel(p.consensus_sentiment)}
                        </span>
                        <span className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[#64748B]">
                          {p.consensus_sentiment.toFixed(2)}
                        </span>
                      </div>
                      <PulseBar value={p.consensus_sentiment} isTop={false} />
                    </div>

                    {/* Aura Stats */}
                    <div className="flex flex-col justify-center gap-1.5 border-l border-[#1E293B]/60 pl-4 h-full">
                      <ConvictionMini level={p.avg_conviction} />
                      <div className="flex items-center gap-1 text-[10px] text-[#8B95A8]">
                        <span className="font-[family-name:var(--font-geist-mono)] font-semibold text-[#F1F5F9]">{p.mention_count}</span>
                        <span>mentions</span>
                        <span className="mx-1">•</span>
                        <span className="font-[family-name:var(--font-geist-mono)] font-semibold text-[#F1F5F9]">{p.analyst_count}</span>
                        <span>analysts</span>
                      </div>
                    </div>

                    {/* Personal Holdings */}
                    <div className="flex flex-col gap-2 border-l border-[#1E293B]/60 pl-4">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-3.5 h-3.5 text-[#00D4AA]" />
                        <span className="text-xs text-[#8B95A8] font-medium w-16">Shares</span>
                        <span className="font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[#00D4AA]">{p.shares}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-3.5 h-3.5 text-[#F59E0B]" />
                        <span className="text-xs text-[#8B95A8] font-medium w-16">Avg Cost</span>
                        <span className="font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[#F59E0B]">
                          {p.currency === 'USD' ? '$' : ''}{p.average_cost}
                        </span>
                      </div>
                    </div>

                    {/* Chevron */}
                    <div className={`hidden md:flex text-[#64748B] ${textHoverClass} transition-colors justify-self-end`}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="transform group-hover:translate-x-1 transition-transform">
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
