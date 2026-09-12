'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, ExternalLink, Activity, ArrowRight, ShieldCheck, Clock, Target, TrendingUp, TrendingDown, Sparkles } from 'lucide-react'
import { StockDirectoryItem } from '@/lib/types'
import { getSentimentLabel, getSentimentBadgeClass, PulseBar, ConvictionMini } from '@/components/TickerRow'
import { formatRelativeTime } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface RecentCatalyst {
  sentiment: number
  conviction_level: number
  catalyst_notes: string
  target_price: number | null
  channel_name: string
  published_at: string
}

interface ExploreQuickPeekProps {
  stock: StockDirectoryItem | null
  onClose: () => void
}

export default function ExploreQuickPeek({ stock, onClose }: ExploreQuickPeekProps) {
  const [catalysts, setCatalysts] = useState<RecentCatalyst[]>([])
  const [loadingCatalysts, setLoadingCatalysts] = useState(false)

  // Listen for Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Fetch recent catalyst quotes whenever selected stock changes
  useEffect(() => {
    if (!stock) {
      setCatalysts([])
      return
    }

    let active = true
    setLoadingCatalysts(true)

    async function fetchCatalysts() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('recommendations')
          .select(`
            sentiment,
            conviction_level,
            catalyst_notes,
            target_price,
            videos!inner(
              published_at,
              channels!inner(channel_name)
            )
          `)
          .eq('ticker', stock!.ticker.toUpperCase())
          .order('id', { ascending: false })
          .limit(3)

        if (!active) return

        if (!error && data) {
          const formatted: RecentCatalyst[] = data.map((d: any) => ({
            sentiment: d.sentiment,
            conviction_level: d.conviction_level,
            catalyst_notes: d.catalyst_notes,
            target_price: d.target_price,
            channel_name: d.videos?.channels?.channel_name || 'Financial Analyst',
            published_at: d.videos?.published_at || '',
          }))
          setCatalysts(formatted)
        }
      } catch (err) {
        console.error('Failed to load catalysts for quick-peek:', err)
      } finally {
        if (active) setLoadingCatalysts(false)
      }
    }

    fetchCatalysts()
    return () => {
      active = false
    }
  }, [stock])

  if (!stock) return null

  const sentiment = stock.overall_sentiment ?? 0
  const direction = sentiment >= 0.5 ? 'BUY' : sentiment <= -0.5 ? 'SELL' : 'NEUTRAL'
  const isBullish = direction === 'BUY'
  const isBearish = direction === 'SELL'

  const accentColor = isBullish ? '#00D4AA' : isBearish ? '#FF4D6A' : '#8B95A8'
  const accentGlow = isBullish
    ? 'rgba(0, 212, 170, 0.15)'
    : isBearish
    ? 'rgba(255, 77, 106, 0.15)'
    : 'rgba(139, 149, 168, 0.1)'

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Dim Backdrop */}
      <div
        className="fixed inset-0 bg-[#0A0F1A]/70 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in Container: Desktop Right Panel / Mobile Bottom Sheet */}
      <div
        className="relative z-10 w-full md:w-[460px] h-[85vh] md:h-full mt-auto md:mt-0 bg-[#141B2D]/95 backdrop-blur-2xl border-t md:border-t-0 md:border-l border-white/10 shadow-2xl flex flex-col overflow-hidden rounded-t-3xl md:rounded-none animate-in slide-in-from-bottom md:slide-in-from-right duration-300"
        style={{
          boxShadow: `0 0 50px -10px ${accentGlow}`,
        }}
      >
        {/* Header Ribbon */}
        <div className="flex items-center justify-between p-5 border-b border-[#1E293B]/80 bg-[#0A0F1A]/60">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: accentColor }} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8B95A8] font-[family-name:var(--font-geist-mono)]">
              Quick Intelligence
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8B95A8] hover:text-[#F1F5F9] hover:bg-[#1E293B]/60 transition-colors"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6">
          {/* Ticker & Title */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-3">
                <h2 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-geist-mono)] text-[#F1F5F9] tracking-tight">
                  {stock.ticker}
                </h2>
                {stock.mention_count_30d > 0 && stock.mention_count_30d < 3 && (
                  <span className="text-[9px] text-[#F59E0B] bg-[#F59E0B]/10 px-2 py-0.5 rounded-full border border-[#F59E0B]/30 font-semibold font-[family-name:var(--font-geist-mono)]">
                    Early Data
                  </span>
                )}
              </div>
              <p className="text-sm text-[#8B95A8] mt-1 font-medium">
                {stock.stock_name || 'Tracked Asset'}
              </p>
            </div>

            {/* Aura Priority Badge */}
            <div className="flex flex-col items-end bg-[#0A0F1A]/80 border border-[#1E293B] px-3 py-2 rounded-xl">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#64748B] font-[family-name:var(--font-geist-mono)]">
                Aura Score
              </span>
              <span className="text-base font-bold text-[#F1F5F9] font-[family-name:var(--font-geist-mono)]">
                {stock.priority_score.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Sentiment Pulse Card */}
          <div className="p-4 rounded-2xl bg-[#0A0F1A]/80 border border-[#1E293B] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#8B95A8] uppercase tracking-wider font-semibold font-[family-name:var(--font-geist-mono)]">
                Consensus Bias
              </span>
              {stock.overall_sentiment !== null ? (
                <span className={getSentimentBadgeClass(stock.overall_sentiment)}>
                  {getSentimentLabel(stock.overall_sentiment)}
                </span>
              ) : (
                <span className="text-xs text-[#64748B]">No Data</span>
              )}
            </div>

            {stock.overall_sentiment !== null && (
              <div className="space-y-1.5">
                <PulseBar value={stock.overall_sentiment} isTop={false} />
                <div className="flex justify-between text-[10px] text-[#64748B] font-[family-name:var(--font-geist-mono)]">
                  <span>Bearish (-2.0)</span>
                  <span className="text-[#F1F5F9] font-bold">{stock.overall_sentiment.toFixed(2)}</span>
                  <span>Bullish (+2.0)</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-[#0A0F1A]/50 border border-[#1E293B] flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[10px] text-[#8B95A8] uppercase tracking-wider font-semibold font-[family-name:var(--font-geist-mono)]">
                <Target className="w-3 h-3 text-[#00D4AA]" />
                <span>Avg Target</span>
              </div>
              <span className="text-xl font-bold text-[#F1F5F9] font-[family-name:var(--font-geist-mono)] mt-2">
                {stock.avg_target_price !== null ? `$${stock.avg_target_price.toFixed(0)}` : '—'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#0A0F1A]/50 border border-[#1E293B] flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[10px] text-[#8B95A8] uppercase tracking-wider font-semibold font-[family-name:var(--font-geist-mono)]">
                <Sparkles className="w-3 h-3 text-[#F59E0B]" />
                <span>Conviction</span>
              </div>
              <div className="mt-2">
                {stock.avg_conviction !== null ? (
                  <ConvictionMini level={stock.avg_conviction} />
                ) : (
                  <span className="text-xs text-[#64748B]">—</span>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#0A0F1A]/50 border border-[#1E293B] flex flex-col justify-between">
              <span className="text-[10px] text-[#8B95A8] uppercase tracking-wider font-semibold font-[family-name:var(--font-geist-mono)]">
                30D Mentions
              </span>
              <span className="text-xl font-bold text-[#F1F5F9] font-[family-name:var(--font-geist-mono)] mt-2">
                {stock.mention_count_30d}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#0A0F1A]/50 border border-[#1E293B] flex flex-col justify-between">
              <span className="text-[10px] text-[#8B95A8] uppercase tracking-wider font-semibold font-[family-name:var(--font-geist-mono)]">
                Unique Analysts
              </span>
              <span className="text-xl font-bold text-[#F1F5F9] font-[family-name:var(--font-geist-mono)] mt-2">
                {stock.analyst_count}
              </span>
            </div>
          </div>

          {/* Recent Catalyst Evidence */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8B95A8] font-[family-name:var(--font-geist-mono)] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00D4AA]" />
                <span>Recent Analyst Evidence</span>
              </h3>
              {stock.last_mentioned_at && (
                <span className="text-[10px] text-[#64748B] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatRelativeTime(stock.last_mentioned_at)}
                </span>
              )}
            </div>

            {loadingCatalysts ? (
              <div className="p-6 rounded-xl bg-[#0A0F1A]/40 border border-[#1E293B] text-center">
                <div className="w-5 h-5 border-2 border-[#00D4AA]/30 border-t-[#00D4AA] rounded-full animate-spin mx-auto mb-2" />
                <span className="text-xs text-[#64748B]">Loading analyst transcripts...</span>
              </div>
            ) : catalysts.length > 0 ? (
              <div className="space-y-2.5">
                {catalysts.map((cat, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-[#0A0F1A]/60 border border-[#1E293B] hover:border-white/10 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#F1F5F9]">{cat.channel_name}</span>
                      <span className={getSentimentBadgeClass(cat.sentiment)}>
                        {getSentimentLabel(cat.sentiment)}
                      </span>
                    </div>
                    {cat.catalyst_notes ? (
                      <p className="text-xs text-[#8B95A8] italic line-clamp-3 leading-relaxed border-l-2 border-[#00D4AA]/40 pl-2">
                        &ldquo;{cat.catalyst_notes}&rdquo;
                      </p>
                    ) : (
                      <p className="text-xs text-[#64748B] italic">No catalyst notes provided.</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#0A0F1A]/40 border border-[#1E293B] text-center">
                <p className="text-xs text-[#64748B]">No recent transcript excerpts found.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-4 md:p-5 border-t border-[#1E293B] bg-[#0A0F1A]/80">
          <Link
            href={`/ticker?s=${stock.ticker}`}
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#00D4AA] to-[#00FFD0] text-[#0A0F1A] font-bold text-sm hover:opacity-95 active:scale-[0.99] transition-all shadow-lg shadow-[#00D4AA]/20 font-[family-name:var(--font-geist-mono)]"
          >
            <span>Open Full Terminal for {stock.ticker}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
