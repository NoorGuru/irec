'use client'

import { Activity, ArrowLeft, TrendingUp, TrendingDown, DollarSign, Briefcase, RefreshCw, Loader2, CheckCircle2, XCircle, Database, Settings, Search, PieChart, X, RotateCcw, BarChart3, ActivitySquare, Shield, Trophy, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { getSentimentLabel, getSentimentBadgeClass, PulseBar, ConvictionMini } from '@/components/TickerRow'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<any[]>([])
  const [allStocks, setAllStocks] = useState<any[]>([])
  const [todayPlays, setTodayPlays] = useState<any[]>([])
  const [dismissedPlays, setDismissedPlays] = useState<string[]>([])
  const [showAllPlays, setShowAllPlays] = useState(false)
  const [showBalances, setShowBalances] = useState(false)
  const [radars, setRadars] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingHotPlays, setLoadingHotPlays] = useState<boolean>(true)
  
  useEffect(() => {
    try {
      const stored = localStorage.getItem('aura_dismissed_plays')
      if (stored) {
        setDismissedPlays(JSON.parse(stored))
      }
    } catch (e) {}
  }, [])
  
  const handleDismissPlay = (ticker: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDismissedPlays(prev => {
      const next = [...prev, ticker]
      try {
        localStorage.setItem('aura_dismissed_plays', JSON.stringify(next))
      } catch (err) {}
      return next
    })
  }
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [session, setSession] = useState<any>(null)
  const [sortBy, setSortBy] = useState<'weight' | 'sentiment' | 'upside' | 'ticker' | '1week' | 'return'>('weight')
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
    setLoadingHotPlays(true)

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      
      // Phase 1: Load holdings and stock stats immediately
      const [portRes, stocksRes] = await Promise.all([
        fetch(`${backendUrl}/api/v1/portfolio/`, {
          headers: { 'Authorization': `Bearer ${sessionData.access_token}` }
        }).then(res => res.json()),
        fetch(`${backendUrl}/api/v1/stocks?fresh=${fresh}`).then(res => res.json())
      ])
      
      const portData = portRes.portfolio || []
      const stocksData = stocksRes.stocks || []
      
      setAllStocks(stocksData)
      
      const validPortData = portData.filter((p: any) => p.shares > 0)
      
      const merged = validPortData.map((p: any) => {
        const stock = stocksData.find((s: any) => s.ticker === p.ticker)
        
        const currentPrice = p.current_price || p.average_cost
        const trueReturn = p.average_cost > 0 ? ((currentPrice - p.average_cost) / p.average_cost) * 100 : 0
        
        return {
          ...p,
          total_return_pct: trueReturn,
          stock_name: stock?.stock_name || null,
          consensus_sentiment: stock?.overall_sentiment || 0,
          avg_target_price: stock?.avg_target_price || null,
          avg_conviction: stock?.avg_conviction || 0,
          mention_count: stock?.mention_count_30d || 0,
          analyst_count: stock?.analyst_count || 0
        }
      })
      
      setPortfolio(merged)
      setLoading(false) // Holdings render instantly!

      // Phase 2: Load radars in the background
      fetch(`${backendUrl}/api/v1/radars`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setRadars(data)
        })
        .catch(err => console.error("Error loading radars:", err))

      // Phase 3: Load Hot Plays in the background
      fetch(`${backendUrl}/api/v1/today?days=30`)
        .then(res => res.json())
        .then(data => {
          if (data && data.plays) setTodayPlays(data.plays)
        })
        .catch(err => console.error("Error loading hot plays:", err))
        .finally(() => {
          setLoadingHotPlays(false)
        })

    } catch (err) {
      console.error(err)
      setLoading(false)
      setLoadingHotPlays(false)
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

  // Basic Totals
  const totalHoldings = portfolio.length
  const totalInvested = portfolio.reduce((acc, p) => acc + (p.shares * p.average_cost), 0)
  const totalMarketValue = portfolio.reduce((acc, p) => acc + (p.shares * (p.current_price || p.average_cost)), 0)
  const totalPandL = totalMarketValue - totalInvested
  const totalPandLPercent = totalInvested > 0 ? (totalPandL / totalInvested) * 100 : 0
  
  const totalTargetValue = portfolio.reduce((acc, p) => acc + (p.shares * (p.avg_target_price || p.current_price || p.average_cost)), 0)
  const totalUpside = totalTargetValue - totalMarketValue
  const totalUpsidePercent = totalMarketValue > 0 ? (totalUpside / totalMarketValue) * 100 : 0

  // Left-Side Additional Analytics
  const todaysPandL = portfolio.reduce((acc, p) => acc + (p.shares * (p.current_price || p.average_cost) * (p.daily_change_pct || 0) / 100), 0)
  const todaysPandLPercent = totalMarketValue > 0 ? (todaysPandL / totalMarketValue) * 100 : 0

  const profitableCount = portfolio.filter(p => {
    const r = p.total_return_pct ?? (p.average_cost > 0 ? ((p.current_price || p.average_cost) - p.average_cost) / p.average_cost * 100 : 0)
    return r >= 0
  }).length
  const winRate = portfolio.length > 0 ? (profitableCount / portfolio.length) * 100 : 0

  const avgAura = portfolio.reduce((acc, p) => acc + (p.consensus_sentiment * (totalMarketValue > 0 ? (p.shares * (p.current_price || p.average_cost)) / totalMarketValue : 0)), 0)

  // Sector Diversification
  const sectorWeights = useMemo(() => {
    const weights: Record<string, number> = {};
    portfolio.forEach(p => {
      const sector = p.sector || 'Other';
      const val = p.shares * (p.current_price || p.average_cost);
      weights[sector] = (weights[sector] || 0) + val;
    });
    return Object.entries(weights)
      .map(([sector, val]) => ({ sector, percent: totalMarketValue > 0 ? (val / totalMarketValue) * 100 : 0 }))
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 3);
  }, [portfolio, totalMarketValue]);

  // Cap Size Risk Breakdown
  const capWeights = useMemo(() => {
    const weights: Record<string, number> = {};
    portfolio.forEach(p => {
      const cap = p.cap_size || 'Other';
      const val = p.shares * (p.current_price || p.average_cost);
      weights[cap] = (weights[cap] || 0) + val;
    });
    return Object.entries(weights)
      .map(([cap, val]) => ({ cap, percent: totalMarketValue > 0 ? (val / totalMarketValue) * 100 : 0 }))
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 5);
  }, [portfolio, totalMarketValue]);

  // Top 3 Holdings Concentration
  const top3Concentration = useMemo(() => {
    if (portfolio.length === 0) return [];
    const sorted = [...portfolio].sort((a, b) => {
      const aVal = a.shares * (a.current_price || a.average_cost);
      const bVal = b.shares * (b.current_price || b.average_cost);
      return bVal - aVal;
    });
    return sorted.slice(0, 3).map(p => {
      const val = p.shares * (p.current_price || p.average_cost);
      return {
        ticker: p.ticker,
        percent: totalMarketValue > 0 ? (val / totalMarketValue) * 100 : 0
      };
    });
  }, [portfolio, totalMarketValue]);
  const top3TotalPercent = top3Concentration.reduce((acc, curr) => acc + curr.percent, 0);

  // Daily Driver (Highest Positive P&L Contribution Today)
  const dailyDriver = useMemo(() => {
    if (portfolio.length === 0) return null;
    return portfolio.reduce((prev, current) => {
      const prevVal = (prev.daily_change_pct || 0) * prev.shares * (prev.current_price || prev.average_cost);
      const currVal = (current.daily_change_pct || 0) * current.shares * (current.current_price || current.average_cost);
      return (prevVal > currVal) ? prev : current;
    });
  }, [portfolio]);

  // Best & Worst All-Time
  const bestWorst = useMemo(() => {
    const sorted = [...portfolio].filter(p => p.total_return_pct !== null && p.total_return_pct !== undefined).sort((a, b) => (b.total_return_pct || 0) - (a.total_return_pct || 0));
    return {
      best: sorted.length > 0 ? sorted[0] : null,
      worst: sorted.length > 0 ? sorted[sorted.length - 1] : null,
    };
  }, [portfolio]);

  // Top Movers and Laggards for all timeframes
  const topMovers = useMemo(() => {
    if (portfolio.length === 0) return {};
    
    const getTop = (key: string) => {
      const valid = portfolio.filter(p => p[key] !== null && p[key] !== undefined);
      if (valid.length === 0) return null;
      return valid.reduce((prev, current) => (prev[key] > current[key]) ? prev : current);
    };

    const getBottom = (key: string) => {
      const valid = portfolio.filter(p => p[key] !== null && p[key] !== undefined);
      if (valid.length === 0) return null;
      return valid.reduce((prev, current) => (prev[key] < current[key]) ? prev : current);
    };

    return {
      '1D': { best: getTop('daily_change_pct'), worst: getBottom('daily_change_pct') },
      '1W': { best: getTop('weekly_change_pct'), worst: getBottom('weekly_change_pct') },
      '1M': { best: getTop('monthly_change_pct'), worst: getBottom('monthly_change_pct') },
      'YTD': { best: getTop('ytd_return_pct'), worst: getBottom('ytd_return_pct') },
      '1Y': { best: getTop('1y_return_pct'), worst: getBottom('1y_return_pct') },
    };
  }, [portfolio]);

  // Sector Analysis Engine
  const sectorInsights = useMemo(() => {
    const STANDARD_SECTORS = ['Technology', 'Healthcare', 'Financials', 'Energy', 'Consumer Defensive', 'Consumer Cyclical', 'Industrials', 'Utilities', 'Real Estate'];
    const insights: any[] = [];
    
    // Check Overweight
    sectorWeights.forEach(sw => {
      if (sw.percent > 35) {
        insights.push({ type: 'warning', text: `Heavy concentration risk in ${sw.sector} (${sw.percent.toFixed(1)}%)` });
      }
    });

    // Check Underweight/Missing
    const currentSectors = sectorWeights.map(s => s.sector.toLowerCase());
    const missing = STANDARD_SECTORS.filter(s => !currentSectors.includes(s.toLowerCase()));
    
    if (missing.length > 0 && allStocks.length > 0) {
      // Find a highly rated stock in the missing sector
      const topMissing = missing[0];
      const suggestion = allStocks
        .filter(s => s.sector && s.sector.toLowerCase() === topMissing.toLowerCase() && s.overall_sentiment > 0.5)
        .sort((a, b) => b.overall_sentiment - a.overall_sentiment)[0];

      if (suggestion) {
        insights.push({ 
          type: 'info', 
          text: `Missing ${topMissing} exposure. Consider hedging with ${suggestion.ticker} (Aura Score: ${suggestion.overall_sentiment.toFixed(1)})` 
        });
      } else {
        insights.push({ type: 'info', text: `Consider diversifying into ${topMissing} to reduce risk.` });
      }
    }

    return insights;
  }, [sectorWeights, allStocks]);

  // Portfolio-Wide Momentum
  const portMomentum = useMemo(() => {
    let d1=0, w1=0, m1=0, ytd=0;
    portfolio.forEach(p => {
      const weight = totalMarketValue > 0 ? (p.shares * (p.current_price || p.average_cost)) / totalMarketValue : 0;
      d1 += (p.daily_change_pct || 0) * weight;
      w1 += (p.weekly_change_pct || 0) * weight;
      m1 += (p.monthly_change_pct || 0) * weight;
      ytd += (p.ytd_return_pct || 0) * weight;
    });
    return { d1, w1, m1, ytd };
  }, [portfolio, totalMarketValue]);

  const allHotPlaysCandidates = useMemo(() => {
    if (!todayPlays.length) return [];
    return todayPlays.filter(p => p.direction === "BUY" && !dismissedPlays.includes(p.ticker));
  }, [todayPlays, dismissedPlays]);

  const hotPlays = useMemo(() => {
    let limit = showAllPlays ? undefined : 6;
    return allHotPlaysCandidates.slice(0, limit).map(c => {
      const pItem = portfolio.find(p => p.ticker === c.ticker);
      if (!pItem) return { ...c, ownedStatus: 'none', weightPercent: 0 };
      
      const positionValue = pItem.shares * (pItem.current_price || pItem.average_cost);
      const weightPercent = totalMarketValue > 0 ? (positionValue / totalMarketValue) * 100 : 0;
      
      return {
        ...c,
        ownedStatus: weightPercent > 2.0 ? 'heavy' : 'light',
        weightPercent
      };
    });
  }, [allHotPlaysCandidates, showAllPlays, portfolio, totalMarketValue]);

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
      const aValue = a.shares * (a.current_price || a.average_cost)
      const bValue = b.shares * (b.current_price || b.average_cost)
      
      const aBase = a.current_price || a.average_cost;
      const bBase = b.current_price || b.average_cost;
      const aUpside = a.avg_target_price ? ((a.avg_target_price - aBase) / aBase) : -9999
      const bUpside = b.avg_target_price ? ((b.avg_target_price - bBase) / bBase) : -9999

      if (sortBy === 'weight') return bValue - aValue
      if (sortBy === 'sentiment') return b.consensus_sentiment - a.consensus_sentiment
      if (sortBy === 'upside') return bUpside - aUpside
      if (sortBy === 'ticker') return a.ticker.localeCompare(b.ticker)
      if (sortBy === '1week') return (b.weekly_change_pct || -9999) - (a.weekly_change_pct || -9999)
      if (sortBy === 'return') return (b.total_return_pct || -9999) - (a.total_return_pct || -9999)
      return 0
    })
  }, [portfolio, sortBy, hideLowData, searchQuery])

  return (
    <div className="min-h-screen bg-[#0A0F1A] p-4 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-up">
        {/* HERO BILLBOARD */}
        <div className="space-y-8">
          <div className="relative w-full rounded-[2.5rem] bg-[#141B2D]/40 border border-[#1E293B] p-8 md:p-12 overflow-hidden flex flex-col lg:flex-row items-start justify-between gap-12 group hover:border-[#00D4AA]/30 transition-colors duration-700">
            
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#00D4AA]/5 blur-[150px] rounded-full pointer-events-none group-hover:bg-[#00D4AA]/10 group-hover:translate-x-10 transition-all duration-1000" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#3B82F6]/5 blur-[150px] rounded-full pointer-events-none group-hover:bg-[#3B82F6]/10 transition-all duration-1000" />

            <div className="relative z-10 flex flex-col w-full lg:w-1/2">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between lg:justify-start gap-4 mb-12">
                <h1 className="text-3xl font-black font-[family-name:var(--font-geist-mono)] tracking-tight text-[#F1F5F9] flex items-center gap-3">
                  <span className="text-[#00D4AA]">/</span>
                  <span>PORTFOLIO</span>
                  {session && (
                    <Link
                      href="/admin"
                      title="Admin Settings"
                      className="p-1.5 text-[#64748B] hover:text-[#00D4AA] rounded-lg transition-all ml-1"
                    >
                      <Settings className="h-5 w-5" />
                    </Link>
                  )}
                </h1>
                
                <div className="flex items-center gap-2">
                  {dismissedPlays.length > 0 && (
                    <button
                      onClick={() => {
                        setDismissedPlays([])
                        localStorage.removeItem('aura_dismissed_plays')
                      }}
                      className="group flex items-center gap-2 rounded-xl border border-[#1E293B] bg-[#0A0F1A]/50 px-3 py-1.5 transition-all duration-200 overflow-hidden shrink-0 text-[#64748B] hover:border-[#FF4D6A]/30 hover:bg-[#FF4D6A]/10 hover:text-[#FF4D6A]"
                    >
                      <RotateCcw className="h-4 w-4 group-hover:-rotate-180 transition-transform duration-500" />
                      <span className="font-bold text-[10px] font-[family-name:var(--font-geist-mono)] uppercase tracking-wider hidden sm:block">Reset Hidden</span>
                    </button>
                  )}
                  
                  <button
                    onClick={handleSync}
                    disabled={syncStatus === 'loading' || syncStatus === 'success'}
                    className={`group flex items-center gap-2 rounded-xl border px-3 py-1.5 transition-all duration-200 overflow-hidden shrink-0 ${
                      syncStatus === 'success' ? 'bg-[#00D4AA]/10 border-[#00D4AA]/20 text-[#00D4AA]' :
                      syncStatus === 'error' ? 'bg-[#FF4D6A]/10 border-[#FF4D6A]/20 text-[#FF4D6A]' :
                      'bg-[#0A0F1A]/50 border-[#1E293B] hover:border-[#00D4AA]/30 text-[#F1F5F9] hover:bg-[#1E293B]/80'
                    }`}
                  >
                    <div className="flex shrink-0 items-center justify-center">
                      {syncStatus === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-[#00D4AA]" />}
                      {syncStatus === 'success' && <CheckCircle2 className="h-4 w-4" />}
                      {syncStatus === 'error' && <XCircle className="h-4 w-4" />}
                      {syncStatus === 'idle' && <RefreshCw className="h-4 w-4 text-[#00D4AA] group-hover:rotate-180 transition-transform duration-500" />}
                    </div>
                    <span className="font-bold text-[10px] font-[family-name:var(--font-geist-mono)] uppercase tracking-wider hidden sm:block">
                      {syncStatus === 'loading' ? 'Syncing...' : syncStatus === 'success' ? 'Synced' : syncStatus === 'error' ? 'Failed' : 'Sync'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Main Numbers */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[#3B82F6] animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-widest text-[#3B82F6]">Current Market Value</span>
                  <button 
                    onClick={() => setShowBalances(!showBalances)} 
                    className="text-[#64748B] hover:text-[#F1F5F9] transition-colors flex items-center justify-center p-1 rounded hover:bg-[#1E293B]"
                    title={showBalances ? "Hide balances" : "Show balances"}
                  >
                    {showBalances ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                
                <h2 className="text-6xl md:text-7xl lg:text-8xl font-black font-[family-name:var(--font-geist-mono)] tracking-tighter text-[#F1F5F9] leading-none">
                  ${loading ? '...' : (showBalances ? totalMarketValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '***,***')}
                </h2>
              </div>
              
              {!loading && totalHoldings > 0 && (
                <div className="flex flex-col gap-6 mt-8">
                  {/* P&L Row */}
                  <div className="flex flex-wrap items-center gap-y-4 gap-x-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold mb-1">Total Invested (Cost Basis)</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl md:text-3xl font-black font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">
                          {showBalances ? `$${Math.round(totalInvested).toLocaleString()}` : '$***,***'}
                        </span>
                      </div>
                    </div>

                    <div className="hidden md:block w-px h-10 bg-[#1E293B] mx-2" />

                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold mb-1">Today's P&L</span>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-2xl md:text-3xl font-black font-[family-name:var(--font-geist-mono)] bg-clip-text text-transparent ${todaysPandL >= 0 ? 'bg-gradient-to-r from-[#00D4AA] to-[#3B82F6]' : 'bg-gradient-to-r from-[#FF4D6A] to-[#F97316]'}`}>
                          {showBalances ? `${todaysPandL >= 0 ? '+' : ''}$${Math.round(todaysPandL).toLocaleString()}` : '$***,***'}
                        </span>
                        <span className={`text-xs md:text-sm font-bold font-[family-name:var(--font-geist-mono)] ${todaysPandL >= 0 ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'}`}>
                          ({showBalances ? `${todaysPandL >= 0 ? '+' : ''}${todaysPandLPercent.toFixed(1)}%` : '***%'})
                        </span>
                      </div>
                    </div>

                    <div className="hidden md:block w-px h-10 bg-[#1E293B] mx-2" />

                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold mb-1">Total All-Time P&L</span>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-2xl md:text-3xl font-black font-[family-name:var(--font-geist-mono)] bg-clip-text text-transparent ${totalPandL >= 0 ? 'bg-gradient-to-r from-[#00D4AA] to-[#3B82F6]' : 'bg-gradient-to-r from-[#FF4D6A] to-[#F97316]'}`}>
                          {showBalances ? `${totalPandL >= 0 ? '+' : ''}$${Math.round(totalPandL).toLocaleString()}` : '$***,***'}
                        </span>
                        <span className={`text-xs md:text-sm font-bold font-[family-name:var(--font-geist-mono)] ${totalPandL >= 0 ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'}`}>
                          ({showBalances ? `${totalPandL >= 0 ? '+' : ''}${totalPandLPercent.toFixed(1)}%` : '***%'})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Metrics Row */}
                  <div className="flex flex-wrap items-center gap-y-4 gap-x-6 pt-6 border-t border-[#1E293B]/50">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold mb-1">Portfolio Win Rate</span>
                      <span className={`text-xl md:text-2xl font-black font-[family-name:var(--font-geist-mono)] ${winRate >= 50 ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'}`}>
                        {winRate.toFixed(1)}% <span className="text-[10px] font-sans font-medium text-[#64748B] ml-1">({profitableCount}/{portfolio.length})</span>
                      </span>
                    </div>
                    
                    <div className="hidden md:block w-px h-8 bg-[#1E293B] mx-2" />
                    
                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold mb-1">Avg Aura Conviction</span>
                      <div className="flex items-center gap-2">
                        <span className={getSentimentBadgeClass(avgAura)}>
                          {getSentimentLabel(avgAura)}
                        </span>
                        <span className={`text-xl md:text-2xl font-black font-[family-name:var(--font-geist-mono)] ${avgAura >= 0 ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'}`}>
                          {avgAura >= 0 ? '+' : ''}{avgAura.toFixed(1)}
                        </span>
                      </div>
                    </div>

                    <div className="hidden md:block w-px h-8 bg-[#1E293B] mx-2" />
                    
                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold mb-1">Implied Analyst Upside</span>
                      <span className={`text-xl md:text-2xl font-black font-[family-name:var(--font-geist-mono)] ${totalUpside >= 0 ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'}`}>
                        {totalUpside >= 0 ? '+' : ''}{totalUpsidePercent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Side: Deep Analytics Hub */}
            {!loading && totalHoldings > 0 && (
              <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4 w-full lg:w-1/2">
                
                {/* Sector Weights */}
                {sectorWeights.length > 0 && (
                  <div className="bg-[#0A0F1A]/60 border border-[#1E293B] p-5 rounded-2xl flex flex-col gap-3 backdrop-blur-md">
                    <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold flex items-center gap-2">
                      <PieChart className="w-3.5 h-3.5 text-[#3B82F6]" /> Sector Exposure
                    </span>
                    <div className="flex flex-col gap-2">
                      {sectorWeights.map((sw) => (
                        <div key={sw.sector} className="flex items-center justify-between text-xs">
                          <span className="text-[#8B95A8] font-medium truncate max-w-[80px]">{sw.sector}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-[#00D4AA] to-[#3B82F6] rounded-full" style={{ width: `${sw.percent}%` }} />
                            </div>
                            <span className="text-[#F1F5F9] font-[family-name:var(--font-geist-mono)] font-bold w-10 text-right">
                              {sw.percent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Allocation Insights Engine */}
                    {sectorInsights.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-[#1E293B]/50 flex flex-col gap-1.5">
                        <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-bold mb-0.5">Allocation Insights</span>
                        {sectorInsights.map((insight, i) => (
                          <div key={i} className={`flex items-start gap-1.5 text-[10px] leading-tight ${insight.type === 'warning' ? 'text-[#F59E0B]' : 'text-[#3B82F6]'}`}>
                            <ActivitySquare className="w-3 h-3 mt-0.5 shrink-0" />
                            <span>{insight.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Cap Size Risk */}
                {capWeights.length > 0 && (
                  <div className="bg-[#0A0F1A]/60 border border-[#1E293B] p-5 rounded-2xl flex flex-col gap-3 backdrop-blur-md">
                    <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-[#8B5CF6]" /> Cap Size Risk
                    </span>
                    <div className="flex flex-col gap-2">
                      {capWeights.map((cw) => (
                        <div key={cw.cap} className="flex items-center justify-between text-xs">
                          <span className="text-[#8B95A8] font-medium truncate max-w-[80px]">{cw.cap}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#D946EF] rounded-full" style={{ width: `${cw.percent}%` }} />
                            </div>
                            <span className="text-[#F1F5F9] font-[family-name:var(--font-geist-mono)] font-bold w-10 text-right">
                              {cw.percent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Port Momentum */}
                <div className="bg-[#0A0F1A]/60 border border-[#1E293B] p-5 rounded-2xl flex flex-col gap-3 backdrop-blur-md">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold flex items-center gap-2">
                      <ActivitySquare className="w-3.5 h-3.5 text-[#F59E0B]" /> Portfolio Weighted Avg
                    </span>
                    <span className="text-[9px] text-[#8B95A8] italic">True performance weighted by position size</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-[#64748B] font-bold">1D</span>
                      <span className={`text-sm font-black font-[family-name:var(--font-geist-mono)] ${portMomentum.d1 >= 0 ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'}`}>
                        {portMomentum.d1 > 0 ? '+' : ''}{portMomentum.d1.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-[#64748B] font-bold">1W</span>
                      <span className={`text-sm font-black font-[family-name:var(--font-geist-mono)] ${portMomentum.w1 >= 0 ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'}`}>
                        {portMomentum.w1 > 0 ? '+' : ''}{portMomentum.w1.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-[#64748B] font-bold">1M</span>
                      <span className={`text-sm font-black font-[family-name:var(--font-geist-mono)] ${portMomentum.m1 >= 0 ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'}`}>
                        {portMomentum.m1 > 0 ? '+' : ''}{portMomentum.m1.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-[#64748B] font-bold">YTD</span>
                      <span className={`text-sm font-black font-[family-name:var(--font-geist-mono)] ${portMomentum.ytd >= 0 ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'}`}>
                        {portMomentum.ytd > 0 ? '+' : ''}{portMomentum.ytd.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Top 3 Asset Concentration Risk */}
                <div className="bg-[#0A0F1A]/60 border border-[#1E293B] p-5 rounded-2xl flex flex-col gap-3 backdrop-blur-md">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-[#EC4899]" /> Top 3 Concentration
                    </span>
                    <span className="text-[9px] text-[#8B95A8] italic">
                      {top3TotalPercent > 50 ? 'High concentration risk detected' : 'Well-diversified allocation'}
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-2 mt-1">
                    {top3Concentration.map((tc) => (
                      <div key={tc.ticker} className="flex items-center justify-between text-xs">
                        <span className="text-[#F1F5F9] font-black font-[family-name:var(--font-geist-mono)] w-12">{tc.ticker}</span>
                        <div className="flex items-center gap-2 flex-1 ml-2">
                          <div className="flex-1 h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-[#EC4899] to-[#F43F5E] rounded-full" style={{ width: `${tc.percent}%` }} />
                          </div>
                          <span className="text-[#F1F5F9] font-[family-name:var(--font-geist-mono)] font-bold w-10 text-right">
                            {tc.percent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                    {top3Concentration.length > 0 && (
                      <div className="mt-1 pt-2 border-t border-[#1E293B]/50 flex justify-between items-center text-[10px]">
                        <span className="text-[#64748B] font-bold uppercase tracking-widest">Total Top 3</span>
                        <span className={`font-black font-[family-name:var(--font-geist-mono)] ${top3TotalPercent > 50 ? 'text-[#EC4899]' : 'text-[#00D4AA]'}`}>
                          {top3TotalPercent.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Combined Movers & Laggards */}
                <div className="bg-[#0A0F1A]/60 border border-[#1E293B] p-5 rounded-2xl flex flex-col gap-3 backdrop-blur-md md:col-span-2">
                  <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold flex items-center gap-2">
                    <Trophy className="w-3.5 h-3.5 text-[#00D4AA]" /> Movers & Laggards
                  </span>
                  
                  <div className="flex flex-col gap-3 mt-1">
                    {[
                      { label: 'All-Time', data: bestWorst, key: 'total_return_pct' },
                      { label: 'YTD', data: topMovers['YTD'], key: 'ytd_return_pct' },
                      { label: '1 Month', data: topMovers['1M'], key: 'monthly_change_pct' },
                      { label: '1 Week', data: topMovers['1W'], key: 'weekly_change_pct' },
                      { label: '1 Day', data: topMovers['1D'], key: 'daily_change_pct' }
                    ].map((row, i) => (
                      <div key={i} className="grid grid-cols-[60px_1fr_1fr] items-center gap-4 text-xs pb-2 border-b border-[#1E293B]/30 last:border-0 last:pb-0">
                        <span className="text-[9px] text-[#8B95A8] font-medium uppercase tracking-wider">{row.label}</span>
                        
                        {/* Best */}
                        <div className="flex items-center justify-start gap-2 border-l-2 border-[#00D4AA]/20 pl-2">
                          {row.data?.best ? (
                            <>
                              <span className="font-black font-[family-name:var(--font-geist-mono)] text-[#F1F5F9] w-10">{row.data.best.ticker}</span>
                              <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${row.data.best[row.key] >= 0 ? 'bg-[#00D4AA]/10 text-[#00D4AA]' : 'bg-[#FF4D6A]/10 text-[#FF4D6A]'}`}>
                                {row.data.best[row.key] > 0 ? '+' : ''}{row.data.best[row.key].toFixed(1)}%
                              </span>
                            </>
                          ) : (
                            <span className="text-[#475569] italic">-</span>
                          )}
                        </div>

                        {/* Worst */}
                        <div className="flex items-center justify-end gap-2 border-r-2 border-[#FF4D6A]/20 pr-2">
                          {row.data?.worst ? (
                            <>
                              <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${row.data.worst[row.key] >= 0 ? 'bg-[#00D4AA]/10 text-[#00D4AA]' : 'bg-[#FF4D6A]/10 text-[#FF4D6A]'}`}>
                                {row.data.worst[row.key] > 0 ? '+' : ''}{row.data.worst[row.key].toFixed(1)}%
                              </span>
                              <span className="font-black font-[family-name:var(--font-geist-mono)] text-[#F1F5F9] w-10 text-right">{row.data.worst.ticker}</span>
                            </>
                          ) : (
                            <span className="text-[#475569] italic">-</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Hot Plays Section */}
          {!loading && (loadingHotPlays || hotPlays.length > 0) && (
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-[#00D4AA] flex items-center gap-2">
                    <span className="text-lg">🔥</span> Analyst Hot Plays to Consider
                  </h2>
                  {!loadingHotPlays && allHotPlaysCandidates.length > 6 && (
                    <button
                      onClick={() => setShowAllPlays(!showAllPlays)}
                      className="text-[10px] uppercase tracking-widest font-bold text-[#64748B] hover:text-[#00D4AA] transition-colors bg-[#0A0F1A]/50 border border-[#1E293B] px-3 py-1.5 rounded-lg hover:bg-[#1E293B]/50"
                    >
                      {showAllPlays ? 'View Less' : `View All (${allHotPlaysCandidates.length})`}
                    </button>
                  )}
                </div>
                
                {loadingHotPlays ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-pulse">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="bg-[#141B2D]/20 border border-[#1E293B] p-4 rounded-2xl h-[100px] flex flex-col justify-between">
                        <div className="h-6 w-12 bg-[#1E293B]/40 rounded" />
                        <div className="space-y-1.5">
                          <div className="h-2 w-16 bg-[#1E293B]/40 rounded" />
                          <div className="h-4 w-8 bg-[#1E293B]/40 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {hotPlays.map((play) => (
                      <div
                        key={play.ticker}
                        className="group relative bg-[#141B2D]/40 border border-[#1E293B] p-4 rounded-2xl hover:border-[#00D4AA]/50 hover:bg-[#1E293B]/40 transition-all duration-300 flex flex-col gap-3 overflow-hidden"
                      >
                        {/* Absolute overlay link to prevent nested links */}
                        <Link
                          href={`/ticker?s=${play.ticker}`}
                          className="absolute inset-0 z-10"
                          aria-label={`View ${play.ticker} details`}
                        />

                        <div className="absolute top-0 right-0 w-16 h-16 bg-[#00D4AA]/10 blur-xl rounded-full pointer-events-none group-hover:bg-[#00D4AA]/20 z-0" />

                        <div className="flex justify-between items-start relative z-0 pointer-events-none">
                          <div className="flex-1 min-w-0">
                            <span className="font-[family-name:var(--font-geist-mono)] text-2xl font-black text-[#F1F5F9] group-hover:text-[#00D4AA] transition-colors truncate">
                              {play.ticker}
                            </span>
                          </div>
                          {play.ownedStatus === 'heavy' ? (
                            <span className="text-[8px] bg-[#3B82F6]/10 text-[#3B82F6] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-[#3B82F6]/20 ml-2 shrink-0">
                              {play.weightPercent.toFixed(1)}%
                            </span>
                          ) : play.ownedStatus === 'light' ? (
                            <span className="text-[8px] bg-[#00D4AA]/10 text-[#00D4AA] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-[#00D4AA]/20 ml-2 shrink-0">
                              {play.weightPercent.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-[8px] bg-[#8B95A8]/10 text-[#8B95A8] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-[#1E293B] ml-2 shrink-0">
                              New
                            </span>
                          )}
                        </div>

                        <button
                          onClick={(e) => handleDismissPlay(play.ticker, e)}
                          className="absolute top-2 right-2 p-1 rounded-lg text-[#64748B] hover:bg-[#FF4D6A]/10 hover:text-[#FF4D6A] opacity-0 group-hover:opacity-100 transition-all z-20 pointer-events-auto"
                          title="Dismiss recommendation"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>

                        <div className="flex flex-col gap-1 relative z-0 pointer-events-none mt-2">
                          <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-bold">Aura Score</span>
                          <div className="flex items-center gap-2">
                            <span className="font-[family-name:var(--font-geist-mono)] text-2xl font-black text-[#F1F5F9]">
                              {play.aura_score}
                            </span>
                            <span className="font-[family-name:var(--font-geist-mono)] text-xs font-bold text-[#00D4AA] bg-[#00D4AA]/10 px-1.5 py-0.5 rounded">
                              +{play.consensus_sentiment.toFixed(1)} sent
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

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
                Weight
              </button>
              <button
                onClick={() => setSortBy('return')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide border transition-all ${
                  sortBy === 'return'
                    ? 'bg-[#00D4AA]/10 border-[#00D4AA]/30 text-[#00D4AA] shadow-sm'
                    : 'bg-transparent border-[#1E293B] text-[#64748B] hover:text-[#8B95A8] hover:border-[#2D3A4F]'
                }`}
              >
                Return %
              </button>
              <button
                onClick={() => setSortBy('1week')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide border transition-all ${
                  sortBy === '1week'
                    ? 'bg-[#00D4AA]/10 border-[#00D4AA]/30 text-[#00D4AA] shadow-sm'
                    : 'bg-transparent border-[#1E293B] text-[#64748B] hover:text-[#8B95A8] hover:border-[#2D3A4F]'
                }`}
              >
                1W Momentum
              </button>
              <button
                onClick={() => setSortBy('sentiment')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide border transition-all ${
                  sortBy === 'sentiment'
                    ? 'bg-[#00D4AA]/10 border-[#00D4AA]/30 text-[#00D4AA] shadow-sm'
                    : 'bg-transparent border-[#1E293B] text-[#64748B] hover:text-[#8B95A8] hover:border-[#2D3A4F]'
                }`}
              >
                Aura Score
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
              const isLowConfidence = p.mention_count < 3
              
              const currentPrice = p.current_price || p.average_cost
              const positionMarketValue = p.shares * currentPrice
              const positionInvested = p.shares * p.average_cost
              const weightPercent = totalMarketValue > 0 ? (positionMarketValue / totalMarketValue) * 100 : 0
              
              // True P&L
              const positionPandLPercent = p.total_return_pct
              const positionPandLDollar = positionMarketValue - positionInvested
              
              // True Implied Upside based on current price
              const positionUpside = p.avg_target_price ? (p.avg_target_price - currentPrice) * p.shares : 0
              const positionUpsidePercent = p.avg_target_price ? ((p.avg_target_price - currentPrice) / currentPrice) * 100 : 0

              // Visual styling for P&L
              const isProfit = positionPandLPercent >= 0
              const borderGlowClass = isProfit 
                ? 'border-l-[#00D4AA] group-hover:shadow-[-4px_0_15px_-3px_rgba(0,212,170,0.3)]' 
                : 'border-l-[#FF4D6A] group-hover:shadow-[-4px_0_15px_-3px_rgba(255,77,106,0.3)]'
              const textHoverClass = isProfit ? 'group-hover:text-[#00D4AA]' : 'group-hover:text-[#FF4D6A]'

              // --- AI ACTION ENGINE LOGIC ---
              const sectorTotalWeight = sectorWeights
                .filter(sw => sw.sector === p.sector)
                .reduce((acc, sw) => acc + sw.percent, 0)
              
              let aiInsight = ""
              let aiIcon = ""
              let aiColorClass = ""
              
              if (weightPercent > 15 || sectorTotalWeight > 35) {
                aiIcon = "⚠️"
                aiColorClass = "text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20"
                if (weightPercent > 15) {
                  aiInsight = `High Concentration Risk. ${p.ticker} alone accounts for ${weightPercent.toFixed(1)}% of your portfolio. Consider trimming to free up capital.`
                } else {
                  aiInsight = `Sector Concentration Risk. ${p.sector} is heavily overweight (${sectorTotalWeight.toFixed(1)}%). Consider hedging with defensive sectors.`
                }
              } else if (p.consensus_sentiment >= 0.5 && weightPercent < 5) {
                aiIcon = "💡"
                aiColorClass = "text-[#00D4AA] bg-[#00D4AA]/10 border-[#00D4AA]/20"
                aiInsight = `Strong Wall St Conviction (${p.consensus_sentiment.toFixed(1)}). At only ${weightPercent.toFixed(1)}% allocation, consider adding to this position.`
              } else if (p.consensus_sentiment <= -0.2) {
                aiIcon = "🔴"
                aiColorClass = "text-[#FF4D6A] bg-[#FF4D6A]/10 border-[#FF4D6A]/20"
                aiInsight = `Bearish Consensus. Wall Street sentiment is negative. Consider exiting position to reallocate capital to higher-conviction plays.`
              } else {
                aiIcon = "⚖️"
                aiColorClass = "text-[#8B95A8] bg-[#1E293B]/60 border-[#334155]/60"
                aiInsight = `Core Holding. Conviction is neutral, maintain position size.`
              }

              return (
                <div
                  key={p.ticker} 
                  className={`group relative w-full rounded-3xl bg-[#141B2D]/40 hover:bg-[#1E293B]/60 border border-[#1E293B]/50 transition-all duration-500 overflow-hidden backdrop-blur-xl ${borderGlowClass}`}
                >
                  {/* Absolute overlay link to prevent nested links */}
                  <Link 
                    href={`/ticker?s=${p.ticker}`} 
                    className="absolute inset-0 z-10"
                    aria-label={`View ${p.ticker} details`}
                  />

                  <div className={`absolute top-0 right-0 w-[400px] h-[400px] blur-[100px] rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700 ${
                    isProfit ? 'bg-[#00D4AA]/5' : 'bg-[#FF4D6A]/5'
                  }`} />
                  
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-300 ${
                    isProfit ? 'bg-[#00D4AA] group-hover:shadow-[0_0_20px_rgba(0,212,170,0.4)]' : 
                    'bg-[#FF4D6A] group-hover:shadow-[0_0_20px_rgba(255,77,106,0.4)]'
                  }`} />

                  <div className="p-6 md:p-8 pl-8 md:pl-10 relative z-0 pointer-events-none flex flex-col gap-8">
                    
                    {/* ROW 1: HEADER */}
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      {/* Left: Ticker & Badges */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <span className={`font-[family-name:var(--font-geist-mono)] text-5xl md:text-6xl font-black tracking-tighter text-[#F1F5F9] ${textHoverClass} transition-colors`}>
                            {p.ticker}
                          </span>
                          {p.sector && (
                            <span className="px-2 py-1 bg-[#1E293B] border border-[#334155] text-[#8B95A8] text-[9px] font-bold uppercase tracking-widest rounded-lg">
                              {p.sector}
                            </span>
                          )}
                          {p.cap_size && p.cap_size !== '0' && (
                            <span className="px-2 py-1 bg-[#1E293B] border border-[#334155] text-[#8B95A8] text-[9px] font-bold uppercase tracking-widest rounded-lg">
                              {p.cap_size} Cap
                            </span>
                          )}
                          {radars.filter((r: any) => r.tickers?.includes(p.ticker)).map((radar: any) => (
                            <Link href={`/radars/${radar.slug}`} key={radar.slug} onClick={(e) => e.stopPropagation()} style={{ color: radar.theme_color, borderColor: `${radar.theme_color}40`, backgroundColor: `${radar.theme_color}10` }} className="relative z-20 pointer-events-auto px-2 py-1 border text-[9px] font-bold uppercase tracking-widest rounded-lg shadow-sm flex items-center gap-1 hover:opacity-80 transition-opacity">
                              <Activity className="w-2.5 h-2.5" />
                              {radar.name}
                            </Link>
                          ))}
                        </div>
                        {/* Allocation Badge */}
                        <div className="flex items-center gap-2 mt-1">
                          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-[#1E293B]/60 border border-[#334155]/60 rounded-lg shadow-sm">
                            <PieChart className="w-3.5 h-3.5 text-[#8B95A8]" />
                            <span className="text-sm font-bold font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">{weightPercent.toFixed(1)}% <span className="text-[#64748B] text-xs">weight</span></span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Market Value & Shares */}
                      <div className="flex flex-col md:items-end gap-1 text-left md:text-right">
                        <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Market Value</span>
                        <span className="font-[family-name:var(--font-geist-mono)] text-4xl font-black text-[#F1F5F9]">
                          ${showBalances ? positionMarketValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '***,***'}
                        </span>
                        <span className="text-sm font-[family-name:var(--font-geist-mono)] text-[#8B95A8] mt-1">
                          <span className="font-bold text-[#F1F5F9]">{showBalances ? (typeof p.shares === 'number' ? Number(p.shares).toLocaleString(undefined, { maximumFractionDigits: 1 }) : p.shares) : '***'}</span> shs
                        </span>
                      </div>
                    </div>

                    {/* ROW 2: FINANCIALS GRID */}
                    <div className="flex flex-col gap-4 pt-6 border-t border-[#1E293B]/50">
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Block 1: Cost vs Live */}
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Cost vs Live</span>
                          <div className="flex flex-col gap-1 font-[family-name:var(--font-geist-mono)] text-sm">
                            <div className="flex justify-between items-center bg-[#0A0F1A]/40 px-2 py-1.5 rounded">
                              <span className="text-[#8B95A8]">Avg</span>
                              <span className="font-bold text-[#F1F5F9]">${typeof p.average_cost === 'number' ? p.average_cost.toFixed(1) : p.average_cost}</span>
                            </div>
                            <div className="flex justify-between items-center bg-[#0A0F1A]/40 px-2 py-1.5 rounded">
                              <span className="text-[#8B95A8]">Live</span>
                              <span className="font-bold text-[#F1F5F9]">${typeof currentPrice === 'number' ? currentPrice.toFixed(1) : currentPrice}</span>
                            </div>
                          </div>
                        </div>

                        {/* Block 2: Total P&L */}
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Total P&L</span>
                          <div className="flex flex-col gap-1 font-[family-name:var(--font-geist-mono)] text-sm">
                            <div className="flex justify-between items-center bg-[#0A0F1A]/40 px-2 py-1.5 rounded">
                              <span className="text-[#8B95A8]">$ Gain</span>
                              <span className={`font-bold ${isProfit ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'}`}>
                                {showBalances ? `${isProfit ? '+' : ''}$${Math.round(positionPandLDollar).toLocaleString()}` : '$***'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center bg-[#0A0F1A]/40 px-2 py-1.5 rounded">
                              <span className="text-[#8B95A8]">% Gain</span>
                              <div className={`inline-flex items-center gap-1 font-bold ${isProfit ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'}`}>
                                <TrendingUp className={`w-3.5 h-3.5 ${!isProfit && 'rotate-180 transform'}`} />
                                {isProfit ? '+' : ''}{positionPandLPercent.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Block 3: Aura Conviction */}
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold flex items-center justify-between">
                            Aura Score
                            {isLowConfidence && <span className="px-1.5 py-0.5 bg-[#F59E0B]/10 text-[#F59E0B] text-[8px] rounded">Low Data</span>}
                          </span>
                          <div className="flex flex-col gap-2 justify-center h-full pb-2">
                            <div className="flex items-center justify-between">
                              <span className={getSentimentBadgeClass(p.consensus_sentiment)}>
                                {getSentimentLabel(p.consensus_sentiment)}
                              </span>
                              <span className="font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[#F1F5F9]">
                                {p.consensus_sentiment > 0 ? '+' : ''}{p.consensus_sentiment.toFixed(1)}
                              </span>
                            </div>
                            <PulseBar value={p.consensus_sentiment} isTop={false} />
                          </div>
                        </div>

                        {/* Block 4: Implied Upside */}
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Implied Upside</span>
                          <div className="flex flex-col gap-1 font-[family-name:var(--font-geist-mono)] text-sm h-full justify-center">
                            {p.avg_target_price ? (
                              <>
                                <div className="flex justify-between items-center bg-[#0A0F1A]/40 px-2 py-1.5 rounded">
                                  <span className="text-[#8B95A8]">Upside</span>
                                  <span className={`font-bold ${positionUpsidePercent >= 0 ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'}`}>
                                    {positionUpsidePercent >= 0 ? '+' : ''}{positionUpsidePercent.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex justify-between items-center bg-[#0A0F1A]/40 px-2 py-1.5 rounded">
                                  <span className="text-[#8B95A8]">Target</span>
                                  <span className="font-bold text-[#F1F5F9]">${Math.round(p.avg_target_price)}</span>
                                </div>
                              </>
                            ) : (
                              <span className="font-[family-name:var(--font-geist-mono)] text-sm text-[#475569] text-center mt-2">N/A</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Momentum Horizontal Bar */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-[family-name:var(--font-geist-mono)] text-[11px] sm:text-xs mt-1">
                        <div className="flex justify-between items-center bg-[#1E293B]/20 border border-[#1E293B]/50 px-3 py-1.5 rounded-lg">
                          <span className="text-[#8B95A8] uppercase font-bold tracking-widest">1D</span>
                          <span className={`font-bold ${(p.daily_change_pct || 0) >= 0 ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'}`}>
                            {(p.daily_change_pct || 0) > 0 ? '+' : ''}{p.daily_change_pct != null ? p.daily_change_pct.toFixed(1) : '-'}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center bg-[#1E293B]/20 border border-[#1E293B]/50 px-3 py-1.5 rounded-lg">
                          <span className="text-[#8B95A8] uppercase font-bold tracking-widest">1W</span>
                          <span className={`font-bold ${(p.weekly_change_pct || 0) >= 0 ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'}`}>
                            {(p.weekly_change_pct || 0) > 0 ? '+' : ''}{p.weekly_change_pct != null ? p.weekly_change_pct.toFixed(1) : '-'}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center bg-[#1E293B]/20 border border-[#1E293B]/50 px-3 py-1.5 rounded-lg">
                          <span className="text-[#8B95A8] uppercase font-bold tracking-widest">YTD</span>
                          <span className={`font-bold ${(p.ytd_return_pct || 0) >= 0 ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'}`}>
                            {(p.ytd_return_pct || 0) > 0 ? '+' : ''}{p.ytd_return_pct != null ? p.ytd_return_pct.toFixed(1) : '-'}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center bg-[#1E293B]/20 border border-[#1E293B]/50 px-3 py-1.5 rounded-lg">
                          <span className="text-[#8B95A8] uppercase font-bold tracking-widest">1Y</span>
                          <span className={`font-bold ${(p['1y_return_pct'] || 0) >= 0 ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'}`}>
                            {(p['1y_return_pct'] || 0) > 0 ? '+' : ''}{p['1y_return_pct'] != null ? p['1y_return_pct'].toFixed(1) : '-'}%
                          </span>
                        </div>
                      </div>

                    </div>

                    {/* ROW 3: AI INSIGHT ENGINE */}
                    <div className={`mt-2 p-4 rounded-xl border flex items-start gap-3 transition-colors ${aiColorClass}`}>
                      <div className="text-lg mt-0.5">{aiIcon}</div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Aura Insight</span>
                        <span className="text-sm font-medium leading-snug">{aiInsight}</span>
                      </div>
                    </div>

                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
