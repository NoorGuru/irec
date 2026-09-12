'use client'

import React from 'react'
import { Target, TrendingUp, TrendingDown, Sparkles, ShieldAlert, ArrowUpRight } from 'lucide-react'

interface TargetCorridorProps {
  prices: number[]
  avgPrice: number | null
  currentPrice?: number | null
  ticker: string
}

export default function TargetCorridor({
  prices,
  avgPrice,
  currentPrice,
  ticker,
}: TargetCorridorProps) {
  if (!prices || prices.length === 0 || avgPrice === null) {
    return (
      <div className="p-5 rounded-2xl bg-[#141B2D]/60 border border-[#1E293B] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1E293B]/60 flex items-center justify-center text-[#64748B]">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#F1F5F9] font-[family-name:var(--font-geist-mono)]">
              Target Price Corridor
            </h3>
            <p className="text-xs text-[#8B95A8]">
              No price targets published by tracked analysts for {ticker} yet.
            </p>
          </div>
        </div>
        <span className="text-xs text-[#64748B] font-[family-name:var(--font-geist-mono)] px-3 py-1.5 rounded-lg bg-[#0A0F1A] border border-[#1E293B]">
          Awaiting targets
        </span>
      </div>
    )
  }

  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const count = prices.length

  // Calculate live upside if current price is provided
  const hasCurrent = currentPrice != null && currentPrice > 0
  const upsidePct = hasCurrent ? ((avgPrice - currentPrice) / currentPrice) * 100 : null
  const maxUpsidePct = hasCurrent ? ((maxPrice - currentPrice) / currentPrice) * 100 : null

  // Establish bounds for visual line
  const effectiveMin = hasCurrent ? Math.min(minPrice, currentPrice) : minPrice
  const effectiveMax = hasCurrent ? Math.max(maxPrice, currentPrice) : maxPrice
  const range = effectiveMax - effectiveMin || 1

  // Position calculations (0% to 100%)
  const minPos = ((minPrice - effectiveMin) / range) * 100
  const avgPos = ((avgPrice - effectiveMin) / range) * 100
  const maxPos = ((maxPrice - effectiveMin) / range) * 100
  const currentPos = hasCurrent ? ((currentPrice - effectiveMin) / range) * 100 : null

  const isPositive = (upsidePct ?? 0) >= 0

  return (
    <div className="p-5 md:p-6 rounded-2xl bg-[#141B2D]/70 backdrop-blur-xl border border-white/5 shadow-xl shadow-black/20 relative overflow-hidden transition-all duration-300">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-1/4 w-48 h-48 bg-[#00D4AA]/5 blur-3xl rounded-full pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00D4AA]/20 to-[#00D4AA]/5 border border-[#00D4AA]/30 flex items-center justify-center text-[#00D4AA] shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#F1F5F9] font-[family-name:var(--font-geist-mono)]">
                Analyst Target Corridor
              </h3>
              <span className="text-[10px] text-[#8B95A8] font-bold px-2 py-0.5 rounded-full bg-[#0A0F1A] border border-[#1E293B] font-[family-name:var(--font-geist-mono)]">
                {count} {count === 1 ? 'Target' : 'Targets'}
              </span>
            </div>
            <p className="text-xs text-[#8B95A8] mt-0.5">
              Consensus projection based on explicit analyst video targets
            </p>
          </div>
        </div>

        {/* Upside Highlight Badge */}
        {hasCurrent && upsidePct !== null && (
          <div
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border self-start sm:self-auto font-[family-name:var(--font-geist-mono)] text-xs font-bold ${
              isPositive
                ? 'border-[#00D4AA]/30 bg-[#00D4AA]/10 text-[#00D4AA] shadow-[0_0_15px_rgba(0,212,170,0.15)]'
                : 'border-[#FF4D6A]/30 bg-[#FF4D6A]/10 text-[#FF4D6A] shadow-[0_0_15px_rgba(255,77,106,0.15)]'
            }`}
          >
            {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            <span>
              {isPositive ? '+' : ''}
              {upsidePct.toFixed(1)}% Implied Upside
            </span>
          </div>
        )}
      </div>

      {/* Visual Corridor Track */}
      <div className="space-y-4 mb-6 relative z-10 px-2 sm:px-4">
        {/* Track labels above */}
        <div className="relative h-6 text-[11px] font-[family-name:var(--font-geist-mono)]">
          {hasCurrent && currentPos !== null && (
            <div
              className="absolute -translate-x-1/2 flex flex-col items-center transition-all duration-500"
              style={{ left: `${Math.max(5, Math.min(95, currentPos))}%` }}
            >
              <span className="text-[10px] uppercase font-bold text-[#8B95A8] tracking-wider">Live</span>
              <span className="font-black text-[#F1F5F9]">${currentPrice.toFixed(0)}</span>
            </div>
          )}
          <div
            className="absolute -translate-x-1/2 flex flex-col items-center transition-all duration-500"
            style={{ left: `${Math.max(8, Math.min(92, avgPos))}%` }}
          >
            <span className="text-[10px] uppercase font-bold text-[#00D4AA] tracking-wider flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" /> Target
            </span>
            <span className="font-black text-[#00FFD0] text-sm">${avgPrice.toFixed(0)}</span>
          </div>
        </div>

        {/* Bar & Markers */}
        <div className="relative h-4 rounded-full bg-[#0A0F1A] border border-[#1E293B] shadow-inner flex items-center">
          {/* Filled Corridor Span from Min to Max */}
          <div
            className="absolute h-2.5 rounded-full bg-gradient-to-r from-[#FF4D6A]/40 via-[#F59E0B]/40 to-[#00D4AA]/60 opacity-80"
            style={{
              left: `${minPos}%`,
              width: `${Math.max(4, maxPos - minPos)}%`,
            }}
          />

          {/* Low Target Pin */}
          <div
            className="absolute w-2 h-2 rounded-full bg-[#FF4D6A] -translate-x-1/2 shadow-[0_0_8px_#FF4D6A]"
            style={{ left: `${minPos}%` }}
            title={`Bear Low: $${minPrice.toFixed(0)}`}
          />

          {/* Current Price Pin (if known) */}
          {hasCurrent && currentPos !== null && (
            <div
              className="absolute w-3.5 h-3.5 rounded-full bg-[#F1F5F9] border-2 border-[#141B2D] -translate-x-1/2 shadow-[0_0_10px_#FFFFFF] z-20"
              style={{ left: `${currentPos}%` }}
              title={`Live Price: $${currentPrice.toFixed(2)}`}
            />
          )}

          {/* Consensus Target Pin */}
          <div
            className="absolute w-4 h-4 rounded-full bg-[#00FFD0] border-2 border-[#0A0F1A] -translate-x-1/2 shadow-[0_0_12px_#00FFD0] z-30 animate-pulse"
            style={{ left: `${avgPos}%` }}
            title={`Consensus Target: $${avgPrice.toFixed(0)}`}
          />

          {/* High Target Pin */}
          <div
            className="absolute w-2 h-2 rounded-full bg-[#00D4AA] -translate-x-1/2 shadow-[0_0_8px_#00D4AA]"
            style={{ left: `${maxPos}%` }}
            title={`Bull High: $${maxPrice.toFixed(0)}`}
          />
        </div>

        {/* Min and Max bounds below track */}
        <div className="flex justify-between text-[11px] text-[#64748B] font-[family-name:var(--font-geist-mono)] pt-1">
          <div className="flex flex-col items-start">
            <span className="text-[9px] uppercase tracking-wider text-[#8B95A8]">Bear Low</span>
            <span className="font-bold text-[#F1F5F9]">${minPrice.toFixed(0)}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] uppercase tracking-wider text-[#64748B]">Spread</span>
            <span className="font-semibold text-[#8B95A8]">${(maxPrice - minPrice).toFixed(0)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] uppercase tracking-wider text-[#8B95A8]">Bull High</span>
            <span className="font-bold text-[#F1F5F9]">${maxPrice.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Corridor Summary Pill Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-4 border-t border-[#1E293B]/60 font-[family-name:var(--font-geist-mono)] text-xs">
        <div className="p-2.5 rounded-xl bg-[#0A0F1A]/60 border border-[#1E293B] flex flex-col">
          <span className="text-[9px] text-[#64748B] uppercase tracking-wider font-semibold">Consensus Target</span>
          <span className="text-base font-bold text-[#00FFD0] mt-0.5">${avgPrice.toFixed(0)}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-[#0A0F1A]/60 border border-[#1E293B] flex flex-col">
          <span className="text-[9px] text-[#64748B] uppercase tracking-wider font-semibold">Target Range</span>
          <span className="text-sm font-bold text-[#F1F5F9] mt-0.5">
            ${minPrice.toFixed(0)} – ${maxPrice.toFixed(0)}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-[#0A0F1A]/60 border border-[#1E293B] flex flex-col">
          <span className="text-[9px] text-[#64748B] uppercase tracking-wider font-semibold">Analyst Consensus</span>
          <span className="text-sm font-bold text-[#F1F5F9] mt-0.5">
            {count} {count === 1 ? 'call' : 'calls recorded'}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-[#0A0F1A]/60 border border-[#1E293B] flex flex-col">
          <span className="text-[9px] text-[#64748B] uppercase tracking-wider font-semibold">Max Upside Call</span>
          <span className="text-sm font-bold text-[#00D4AA] mt-0.5">
            {maxUpsidePct !== null ? `+${maxUpsidePct.toFixed(0)}%` : `$${maxPrice.toFixed(0)}`}
          </span>
        </div>
      </div>
    </div>
  )
}
