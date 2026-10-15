'use client'

import Link from 'next/link'
import { ShieldCheck, ArrowRight, Activity } from 'lucide-react'

interface TopAlphaZeroStateProps {
  totalPlays: number
}

export default function TopAlphaZeroState({ totalPlays }: TopAlphaZeroStateProps) {
  return (
    <div className="relative rounded-3xl border border-[#1E293B] bg-[#141B2D]/40 backdrop-blur-md p-6 sm:p-8 text-center overflow-hidden">
      {/* Soft Ambient Radial */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full blur-[120px] pointer-events-none bg-gradient-to-br from-[#00D4AA]/5 via-transparent to-transparent opacity-50" />

      <div className="relative z-10 max-w-lg mx-auto flex flex-col items-center">
        <div className="w-12 h-12 rounded-2xl bg-[#00D4AA]/10 border border-[#00D4AA]/25 flex items-center justify-center mb-4 text-[#00D4AA] shadow-[0_0_20px_rgba(0,212,170,0.15)]">
          <ShieldCheck className="w-6 h-6" />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0A0F1A]/80 border border-[#1E293B] text-[10px] font-black uppercase tracking-widest text-[#00D4AA] font-[family-name:var(--font-geist-mono)] mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse" />
          <span>Strict Conviction Gate Active</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-extrabold text-[#F1F5F9] tracking-tight">
          0 High-Conviction Buys Today
        </h3>

        <p className="text-xs sm:text-sm text-[#8B95A8] mt-2.5 leading-relaxed font-light">
          Our algorithmic quality gate strictly requires <strong className="text-[#F1F5F9] font-medium">≥2 independent channels</strong>,{' '}
          <strong className="text-[#F1F5F9] font-medium">≥75% consensus agreement</strong>, and{' '}
          <strong className="text-[#00D4AA] font-medium">≥60 Aura score</strong>. None of the {totalPlays} active plays currently meet this strict institutional threshold.
        </p>

        <div className="mt-4 p-3 rounded-xl bg-[#0A0F1A]/70 border border-[#1E293B] text-left text-xs text-[#64748B] flex items-start gap-2.5 max-w-md">
          <Activity className="w-4 h-4 text-[#38BDF8] shrink-0 mt-0.5" />
          <span>
            <strong className="text-[#94A3B8]">Capital Discipline:</strong> In transitional or uncertain market environments, preserving dry powder is an active alpha decision.
          </span>
        </div>

        <div className="mt-6">
          <Link
            href="/today"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#141B2D] hover:bg-[#1E293B] border border-[#1E293B] hover:border-[#00D4AA]/40 text-xs font-bold text-[#F1F5F9] font-[family-name:var(--font-geist-mono)] transition-all group"
          >
            <span>Screen All {totalPlays} Active Plays</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#00D4AA] group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  )
}
