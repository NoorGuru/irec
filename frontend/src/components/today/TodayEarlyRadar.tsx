'use client'

import React from 'react'
import { Radio, Info, ChevronUp, ChevronDown } from 'lucide-react'
import { motion } from 'framer-motion'

interface TodayEarlyRadarProps {
  isBuyTab: boolean
  emergingCount: number
  showExplainer: boolean
  onToggleExplainer: () => void
}

export default function TodayEarlyRadar({
  isBuyTab,
  emergingCount,
  showExplainer,
  onToggleExplainer,
}: TodayEarlyRadarProps) {
  const earlyColorText = isBuyTab ? 'text-[#16A34A]' : 'text-[#F87171]'
  const earlyColorBg = isBuyTab ? 'bg-[#16A34A]' : 'bg-[#F87171]'
  const earlyColorBorder = isBuyTab ? 'border-[#16A34A]/40' : 'border-[#F87171]/40'
  const earlyShadow = isBuyTab ? 'shadow-[0_0_12px_rgba(22,163,74,0.25)]' : 'shadow-[0_0_12px_rgba(248,113,113,0.2)]'
  const earlyBgBadge = isBuyTab ? 'bg-[#16A34A]/15' : 'bg-[#F87171]/10'
  const earlyBgContainer = isBuyTab
    ? 'from-[#16A34A]/12 via-[#141B2D]/60 to-transparent'
    : 'from-[#F87171]/10 via-[#141B2D]/60 to-transparent'
  const earlyBorderContainer = isBuyTab ? 'border-[#16A34A]/30' : 'border-[#F87171]/25'

  return (
    <div className={`rounded-2xl border ${earlyBorderContainer} bg-gradient-to-r ${earlyBgContainer} p-4 md:p-5 shadow-lg shadow-black/20`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl ${earlyBgBadge} border ${earlyColorBorder} flex items-center justify-center ${earlyColorText} shrink-0 ${earlyShadow}`}>
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm md:text-base font-black tracking-wider uppercase text-[#F1F5F9] font-[family-name:var(--font-geist-mono)]">
                {isBuyTab ? 'Early Buy Radar / Developing Signals' : 'Early Sell Radar / Developing Signals'}
              </h3>
              <span className={`text-[10px] font-[family-name:var(--font-geist-mono)] font-bold px-2 py-0.5 rounded ${earlyBgBadge} border ${earlyColorBorder} ${earlyColorText}`}>
                {emergingCount} DETECTED
              </span>
            </div>
            <p className="text-xs text-[#8B95A8] mt-0.5">
              {isBuyTab
                ? 'Aura Score 35–49 · Emerging bullish coverage before broader market consensus forms'
                : 'Aura Score 35–49 · Emerging distribution & downside warnings before mass downgrades'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleExplainer}
          className={`self-start md:self-auto text-xs ${earlyColorText} hover:text-white flex items-center gap-1.5 font-[family-name:var(--font-geist-mono)] px-3 py-1.5 rounded-lg ${earlyBgBadge} border ${earlyColorBorder} transition-all cursor-pointer`}
        >
          <Info className="w-3.5 h-3.5" />
          <span>{showExplainer ? 'Hide Details' : 'How It Works'}</span>
          {showExplainer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expandable Explainer */}
      {showExplainer && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className={`mt-4 pt-4 border-t ${earlyColorBorder} grid grid-cols-1 md:grid-cols-3 gap-4 text-xs`}
        >
          {isBuyTab ? (
            <>
              <div className="space-y-1.5 bg-[#0A0F1A]/60 p-3.5 rounded-xl border border-white/5">
                <div className="font-bold text-[#F1F5F9] font-[family-name:var(--font-geist-mono)] flex items-center gap-1.5 text-[11px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${earlyColorBg}`} />
                  Score Range (35–49)
                </div>
                <p className="text-[#8B95A8] text-[11px] leading-relaxed">
                  Scores below 35 are discarded as noise. Plays between 35 and 49 indicate verified analyst conviction that has cleared the baseline noise floor.
                </p>
                <div className="pt-1 text-[10px] text-[#16A34A] font-semibold font-[family-name:var(--font-geist-mono)]">
                  Status: Early Accumulation Signal
                </div>
              </div>
              <div className="space-y-1.5 bg-[#0A0F1A]/60 p-3.5 rounded-xl border border-white/5">
                <div className="font-bold text-[#F1F5F9] font-[family-name:var(--font-geist-mono)] flex items-center gap-1.5 text-[11px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${earlyColorBg}`} />
                  Early Discovery Edge
                </div>
                <p className="text-[#8B95A8] text-[11px] leading-relaxed">
                  Surfaces fresh buy recommendations early, giving you a head start to research catalysts and watch setups before multi-analyst consensus bids up the price.
                </p>
                <div className="pt-1 text-[10px] text-[#16A34A] font-semibold font-[family-name:var(--font-geist-mono)]">
                  Edge: Front-run Multi-Analyst Consensus
                </div>
              </div>
              <div className="space-y-1.5 bg-[#0A0F1A]/60 p-3.5 rounded-xl border border-white/5">
                <div className="font-bold text-[#F1F5F9] font-[family-name:var(--font-geist-mono)] flex items-center gap-1.5 text-[11px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${earlyColorBg}`} />
                  Dynamic Lifecycle
                </div>
                <p className="text-[#8B95A8] text-[11px] leading-relaxed">
                  As more analysts confirm coverage, these plays graduate directly into the High Conviction board (score 50+).
                </p>
                <div className="pt-1 text-[10px] text-[#16A34A] font-semibold font-[family-name:var(--font-geist-mono)]">
                  Transition: Auto-graduates on consensus
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5 bg-[#0A0F1A]/60 p-3.5 rounded-xl border border-white/5">
                <div className="font-bold text-[#F1F5F9] font-[family-name:var(--font-geist-mono)] flex items-center gap-1.5 text-[11px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${earlyColorBg}`} />
                  Score Range (35–49)
                </div>
                <p className="text-[#8B95A8] text-[11px] leading-relaxed">
                  Identifies isolated sell recommendations or distribution warnings before broad negative consensus sets in.
                </p>
                <div className="pt-1 text-[10px] text-[#F87171] font-semibold font-[family-name:var(--font-geist-mono)]">
                  Status: Emerging Distribution
                </div>
              </div>
              <div className="space-y-1.5 bg-[#0A0F1A]/60 p-3.5 rounded-xl border border-white/5">
                <div className="font-bold text-[#F1F5F9] font-[family-name:var(--font-geist-mono)] flex items-center gap-1.5 text-[11px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${earlyColorBg}`} />
                  Defensive Edge
                </div>
                <p className="text-[#8B95A8] text-[11px] leading-relaxed">
                  Acts as an early tripwire to review stop-losses, reduce position sizing, or hedge before widespread analyst downgrades trigger institutional outflows.
                </p>
                <div className="pt-1 text-[10px] text-[#F87171] font-semibold font-[family-name:var(--font-geist-mono)]">
                  Edge: Early Defensive Position Review
                </div>
              </div>
              <div className="space-y-1.5 bg-[#0A0F1A]/60 p-3.5 rounded-xl border border-white/5">
                <div className="font-bold text-[#F1F5F9] font-[family-name:var(--font-geist-mono)] flex items-center gap-1.5 text-[11px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${earlyColorBg}`} />
                  Escalation Path
                </div>
                <p className="text-[#8B95A8] text-[11px] leading-relaxed">
                  If additional channels report bearish theses, the score jumps to 50+ and escalates into High Conviction Short / Exit signals.
                </p>
                <div className="pt-1 text-[10px] text-[#F87171] font-semibold font-[family-name:var(--font-geist-mono)]">
                  Transition: Escalates to Short on multi-channel calls
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}
    </div>
  )
}
