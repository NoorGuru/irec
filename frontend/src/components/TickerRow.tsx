import Link from 'next/link'
import { AggregatedTicker } from '@/lib/types'
import { formatRelativeTime, formatLocalTime } from '@/lib/utils'

export function getSentimentLabel(value: number): string {
  if (value >= 1.5) return "Strong Buy"
  if (value >= 0.5) return "Buy"
  if (value > -0.5) return "Neutral"
  if (value > -1.5) return "Sell"
  return "Strong Sell"
}

export function getSentimentBadgeClass(value: number): string {
  if (value >= 1.5) return "sentiment-badge sentiment-badge-strong-buy"
  if (value >= 0.5) return "sentiment-badge sentiment-badge-buy"
  if (value > -0.5) return "sentiment-badge sentiment-badge-neutral"
  if (value > -1.5) return "sentiment-badge sentiment-badge-sell"
  return "sentiment-badge sentiment-badge-strong-sell"
}

export function sentimentToPercent(value: number): number {
  return ((value + 2) / 4) * 100
}

export function PulseBar({ value, isTop }: { value: number; isTop: boolean }) {
  const percent = sentimentToPercent(value)
  const isStrong = Math.abs(value) >= 1.5

  return (
    <div className={`relative w-full h-2 rounded-full bg-[#1E293B] overflow-hidden ${isStrong ? 'h-2.5' : ''}`}>
      <div
        className="pulse-bar-fill absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${percent}%`,
          background: `linear-gradient(90deg, var(--aura-bear-strong) 0%, var(--aura-bear) 20%, #F59E0B 50%, var(--aura-bull) 80%, var(--aura-bull-strong) 100%)`,
          opacity: isTop ? 1 : 0.8,
        }}
      />
    </div>
  )
}

export function ConvictionMini({ level }: { level: number }) {
  const rounded = Math.round(level)
  return (
    <div className="flex items-center gap-1" title={`Conviction: ${level.toFixed(1)}/10`}>
      <div className="flex gap-[2px]">
        {Array.from({ length: 5 }, (_, i) => {
          const filled = i < Math.round(rounded / 2)
          return (
            <div
              key={i}
              className={`w-1 h-3 rounded-[1px] ${filled ? 'bg-[#00D4AA]' : 'bg-[#1E293B]'}`}
            />
          )
        })}
      </div>
      <span className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[#64748B]">
        {level.toFixed(1)}
      </span>
    </div>
  )
}

export function TickerRow({
  row,
  index,
  isTop,
  compact = false,
}: {
  row: AggregatedTicker
  index: number
  isTop: boolean
  compact?: boolean
}) {
  const staggerClass = `stagger-${Math.min(index + 1, 10)}`
  const isLowConfidence = row.mention_count < 3
  
  const direction = row.consensus_sentiment >= 0.5 ? 'BUY' : row.consensus_sentiment <= -0.5 ? 'SELL' : 'NEUTRAL'

  const borderGlowClass = direction === 'BUY' 
    ? 'border-l-[#00D4AA] group-hover:shadow-[-4px_0_15px_-3px_rgba(0,212,170,0.3)]' 
    : direction === 'SELL' 
      ? 'border-l-[#FF4D6A] group-hover:shadow-[-4px_0_15px_-3px_rgba(255,77,106,0.3)]'
      : 'border-l-[#8B95A8] group-hover:shadow-[-4px_0_15px_-3px_rgba(139,149,168,0.3)]'

  const textHoverClass = direction === 'BUY' ? 'group-hover:text-[#00D4AA]' : direction === 'SELL' ? 'group-hover:text-[#FF4D6A]' : 'group-hover:text-[#8B95A8]'

  return (
    <div className={`animate-fade-up ${staggerClass}`}>
      <Link
        href={`/ticker?s=${row.ticker}`}
        className={`
          group block relative w-full mb-3 rounded-r-xl rounded-l-sm bg-[#141B2D]/40 hover:bg-[#1E293B]/40 
          border border-transparent border-l-4 ${borderGlowClass}
          transition-all duration-300
          ${isLowConfidence ? 'opacity-70 hover:opacity-100' : ''}
          ${isTop ? 'bg-[#141B2D]/60' : ''}
        `}
      >
        <div className="absolute inset-0 rounded-r-xl border-y border-r border-[#1E293B]/50 pointer-events-none transition-colors group-hover:border-white/5" />
        
        <div className="p-4 md:p-5 w-full">
          {compact ? (
            <div className="hidden md:grid md:grid-cols-[1.2fr_1.8fr_1.2fr_auto] md:items-center md:gap-4 relative z-10">
              <div className="flex flex-col justify-center min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className={`font-[family-name:var(--font-geist-mono)] text-lg font-bold tracking-wide text-[#F1F5F9] ${textHoverClass} transition-colors leading-none`}>
                    {row.ticker}
                  </span>
                  {isLowConfidence && (
                    <span className="inline-flex items-center text-[8px] text-[#F59E0B]/70 bg-[#F59E0B]/5 px-1 py-0.5 rounded leading-none shrink-0 font-medium">low data</span>
                  )}
                </div>
                {row.stock_name && (
                  <span className="text-[10px] text-[#64748B] truncate mt-1.5 max-w-[120px]">{row.stock_name}</span>
                )}
                {row.current_price != null && (
                  <div className="relative group/price flex flex-col mt-2.5 bg-[#0A0F1A]/80 backdrop-blur-xl border border-white/5 rounded-lg px-2 py-1.5 w-max overflow-hidden shadow-[0_4px_12px_rgb(0,0,0,0.3)]">
                    {row.price_change_pct != null && (
                      <div 
                        className={`absolute inset-0 opacity-20 group-hover/price:opacity-30 transition-opacity duration-500 blur-lg ${
                          row.price_change_pct >= 0 ? 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#00D4AA]/40 to-transparent' : 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#FF4D6A]/40 to-transparent'
                        }`}
                      />
                    )}
                    <div className="relative z-10 flex items-end gap-1.5">
                      <span className="font-[family-name:var(--font-geist-mono)] text-sm font-black text-[#F1F5F9] leading-none tracking-tighter drop-shadow-md">
                        ${row.current_price.toFixed(2)}
                      </span>
                      {row.price_change_pct != null && (
                        <span 
                          className={`flex items-center gap-1 font-[family-name:var(--font-geist-mono)] text-[9px] font-bold px-1 py-0.5 rounded border backdrop-blur-md ${
                            row.price_change_pct >= 0 
                              ? 'bg-[#00D4AA]/10 text-[#00FFD0] border-[#00D4AA]/20 shadow-[0_0_8px_rgba(0,212,170,0.1)]' 
                              : 'bg-[#FF4D6A]/10 text-[#FF4D6A] border-[#FF4D6A]/20 shadow-[0_0_8px_rgba(255,77,106,0.1)]'
                          }`}
                          title="Change since market open"
                        >
                          {row.price_change_pct > 0 ? '+' : ''}{row.price_change_pct.toFixed(2)}%
                        </span>
                      )}
                    </div>
                    {row.price_fetched_at && (
                      <div className="relative z-10 flex items-center gap-1 mt-1">
                        <div className="relative flex h-1 w-1">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                            row.price_change_pct && row.price_change_pct >= 0 ? 'bg-[#00D4AA]' : 'bg-[#FF4D6A]'
                          }`}></span>
                          <span className={`relative inline-flex rounded-full h-1 w-1 ${
                            row.price_change_pct && row.price_change_pct >= 0 ? 'bg-[#00D4AA]' : 'bg-[#FF4D6A]'
                          }`}></span>
                        </div>
                        <span className="font-[family-name:var(--font-geist-mono)] text-[8px] text-[#8B95A8] uppercase tracking-widest cursor-help" title={`Fetched at ${formatLocalTime(row.price_fetched_at)}`}>
                          {formatRelativeTime(row.price_fetched_at)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-center max-w-[170px] w-full">
                <div className="flex justify-between items-end mb-1">
                  <span className={getSentimentBadgeClass(row.consensus_sentiment)}>
                    {getSentimentLabel(row.consensus_sentiment)}
                  </span>
                  <span className="font-[family-name:var(--font-geist-mono)] text-[9px] text-[#64748B]">
                    {row.consensus_sentiment.toFixed(2)}
                  </span>
                </div>
                <PulseBar value={row.consensus_sentiment} isTop={isTop} />
              </div>

              <div className="flex flex-col justify-center gap-1.5 border-l border-[#1E293B]/60 pl-4 h-full">
                <ConvictionMini level={row.avg_conviction} />
                <div className="flex items-center gap-1 text-[10px] text-[#8B95A8]">
                  <span className="font-[family-name:var(--font-geist-mono)] font-semibold text-[#F1F5F9]">{row.mention_count}</span>
                  <span>{row.mention_count === 1 ? 'mention' : 'mentions'}</span>
                </div>
              </div>

              <div className={`text-[#64748B] ${textHoverClass} transition-colors justify-self-end`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="transform group-hover:translate-x-0.5 transition-transform">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </div>
          ) : (
            <div className="hidden md:grid md:grid-cols-[1.5fr_2fr_1.5fr_1fr_auto] md:items-center md:gap-6 relative z-10">
              <div className="flex flex-col justify-center min-w-0">
                <div className="flex items-baseline gap-3 overflow-hidden">
                  <span className={`font-[family-name:var(--font-geist-mono)] text-xl font-bold tracking-wide text-[#F1F5F9] ${textHoverClass} transition-colors`}>
                    {row.ticker}
                  </span>
                  <span className="text-xs text-[#64748B] truncate max-w-[140px]">{row.stock_name}</span>
                </div>
                {row.current_price != null && (
                  <div className="relative group/price flex flex-col mt-2.5 bg-[#0A0F1A]/80 backdrop-blur-xl border border-white/5 rounded-lg px-2.5 py-1.5 w-max overflow-hidden shadow-[0_4px_12px_rgb(0,0,0,0.3)]">
                    {row.price_change_pct != null && (
                      <div 
                        className={`absolute inset-0 opacity-20 group-hover/price:opacity-30 transition-opacity duration-500 blur-lg ${
                          row.price_change_pct >= 0 ? 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#00D4AA]/40 to-transparent' : 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#FF4D6A]/40 to-transparent'
                        }`}
                      />
                    )}
                    <div className="relative z-10 flex items-end gap-2">
                      <span className="font-[family-name:var(--font-geist-mono)] text-base font-black text-[#F1F5F9] leading-none tracking-tighter drop-shadow-md">
                        ${row.current_price.toFixed(2)}
                      </span>
                      {row.price_change_pct != null && (
                        <span 
                          className={`flex items-center gap-1 font-[family-name:var(--font-geist-mono)] text-[10px] font-bold px-1.5 py-0.5 rounded border backdrop-blur-md ${
                            row.price_change_pct >= 0 
                              ? 'bg-[#00D4AA]/10 text-[#00FFD0] border-[#00D4AA]/20 shadow-[0_0_8px_rgba(0,212,170,0.1)]' 
                              : 'bg-[#FF4D6A]/10 text-[#FF4D6A] border-[#FF4D6A]/20 shadow-[0_0_8px_rgba(255,77,106,0.1)]'
                          }`}
                          title="Change since market open"
                        >
                          {row.price_change_pct > 0 ? '+' : ''}{row.price_change_pct.toFixed(2)}%
                        </span>
                      )}
                    </div>
                    {row.price_fetched_at && (
                      <div className="relative z-10 flex items-center gap-1 mt-1.5">
                        <div className="relative flex h-1 w-1">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                            row.price_change_pct && row.price_change_pct >= 0 ? 'bg-[#00D4AA]' : 'bg-[#FF4D6A]'
                          }`}></span>
                          <span className={`relative inline-flex rounded-full h-1 w-1 ${
                            row.price_change_pct && row.price_change_pct >= 0 ? 'bg-[#00D4AA]' : 'bg-[#FF4D6A]'
                          }`}></span>
                        </div>
                        <span className="font-[family-name:var(--font-geist-mono)] text-[9px] text-[#8B95A8] uppercase tracking-widest cursor-help" title={`Fetched at ${formatLocalTime(row.price_fetched_at)}`}>
                          {formatRelativeTime(row.price_fetched_at)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-center max-w-[200px] w-full">
                <div className="flex justify-between items-end mb-1">
                  <span className={getSentimentBadgeClass(row.consensus_sentiment)}>
                    {getSentimentLabel(row.consensus_sentiment)}
                  </span>
                  <span className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[#64748B]">
                    {row.consensus_sentiment.toFixed(2)}
                  </span>
                </div>
                <PulseBar value={row.consensus_sentiment} isTop={isTop} />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#8B95A8] font-medium w-16">Mentions</span>
                  <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[#F1F5F9]">{row.mention_count}</span>
                  {isLowConfidence && (
                    <span className="ml-1 inline-flex items-center text-[9px] text-[#F59E0B]/70 bg-[#F59E0B]/5 px-1 py-0.5 rounded">low data</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#64748B] font-medium w-16">Analysts</span>
                  <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[#8B95A8]">{row.analyst_count}</span>
                </div>
              </div>

              <div className="flex flex-col justify-center gap-1.5 border-l border-[#1E293B]/60 pl-6 h-full">
                <ConvictionMini level={row.avg_conviction} />
                {row.avg_target_price !== null ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-[10px] text-[#64748B] uppercase tracking-wider">PT</span>
                    <span className="font-[family-name:var(--font-geist-mono)] text-sm font-semibold text-[#F1F5F9]">
                      ${row.avg_target_price.toFixed(0)}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-[#64748B]">No Target</span>
                )}
              </div>

              <div className={`text-[#64748B] ${textHoverClass} transition-colors justify-self-end`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="transform group-hover:translate-x-1 transition-transform">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </div>
          )}

          <div className="md:hidden flex flex-col gap-3 relative z-10">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className={`font-[family-name:var(--font-geist-mono)] text-2xl font-bold tracking-wide text-[#F1F5F9] ${textHoverClass} transition-colors`}>
                    {row.ticker}
                  </span>
                  {isLowConfidence && (
                    <span className="inline-flex items-center text-[9px] text-[#F59E0B]/70 bg-[#F59E0B]/5 px-1 py-0.5 rounded">
                      low data
                    </span>
                  )}
                </div>
                {row.stock_name && (
                  <p className="text-xs text-[#64748B] mt-0.5 truncate max-w-[200px]">{row.stock_name}</p>
                )}
                {row.current_price != null && (
                  <div className="relative group/price flex flex-col mt-3 bg-[#0A0F1A]/80 backdrop-blur-xl border border-white/5 rounded-lg px-2.5 py-1.5 w-max overflow-hidden shadow-[0_4px_12px_rgb(0,0,0,0.3)]">
                    {row.price_change_pct != null && (
                      <div 
                        className={`absolute inset-0 opacity-20 group-hover/price:opacity-30 transition-opacity duration-500 blur-lg ${
                          row.price_change_pct >= 0 ? 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#00D4AA]/40 to-transparent' : 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#FF4D6A]/40 to-transparent'
                        }`}
                      />
                    )}
                    <div className="relative z-10 flex items-end gap-2">
                      <span className="font-[family-name:var(--font-geist-mono)] text-base font-black text-[#F1F5F9] leading-none tracking-tighter drop-shadow-md">
                        ${row.current_price.toFixed(2)}
                      </span>
                      {row.price_change_pct != null && (
                        <span 
                          className={`flex items-center gap-1 font-[family-name:var(--font-geist-mono)] text-[10px] font-bold px-1.5 py-0.5 rounded border backdrop-blur-md ${
                            row.price_change_pct >= 0 
                              ? 'bg-[#00D4AA]/10 text-[#00FFD0] border-[#00D4AA]/20 shadow-[0_0_8px_rgba(0,212,170,0.1)]' 
                              : 'bg-[#FF4D6A]/10 text-[#FF4D6A] border-[#FF4D6A]/20 shadow-[0_0_8px_rgba(255,77,106,0.1)]'
                          }`}
                          title="Change since market open"
                        >
                          {row.price_change_pct > 0 ? '+' : ''}{row.price_change_pct.toFixed(2)}%
                        </span>
                      )}
                    </div>
                    {row.price_fetched_at && (
                      <div className="relative z-10 flex items-center gap-1 mt-1.5">
                        <div className="relative flex h-1 w-1">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                            row.price_change_pct && row.price_change_pct >= 0 ? 'bg-[#00D4AA]' : 'bg-[#FF4D6A]'
                          }`}></span>
                          <span className={`relative inline-flex rounded-full h-1 w-1 ${
                            row.price_change_pct && row.price_change_pct >= 0 ? 'bg-[#00D4AA]' : 'bg-[#FF4D6A]'
                          }`}></span>
                        </div>
                        <span className="font-[family-name:var(--font-geist-mono)] text-[9px] text-[#8B95A8] uppercase tracking-widest cursor-help" title={`Fetched at ${formatLocalTime(row.price_fetched_at)}`}>
                          {formatRelativeTime(row.price_fetched_at)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                {row.avg_target_price !== null && (
                  <div className="font-[family-name:var(--font-geist-mono)] text-lg font-semibold text-[#F1F5F9]">
                    ${row.avg_target_price.toFixed(0)}
                  </div>
                )}
                <ConvictionMini level={row.avg_conviction} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 mt-2">
              <PulseBar value={row.consensus_sentiment} isTop={isTop} />
              <div className="flex items-center justify-between">
                <span className={getSentimentBadgeClass(row.consensus_sentiment)}>
                  {getSentimentLabel(row.consensus_sentiment)}
                </span>
                <div className="flex gap-3 text-[10px] text-[#64748B]">
                  <span>{row.mention_count} mentions</span>
                  <span>{row.analyst_count} analysts</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}
