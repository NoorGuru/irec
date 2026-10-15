'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { X, ExternalLink, ArrowRight } from 'lucide-react'
import { TopAlphaPlay } from '@/lib/types'
import { formatRelativeTime } from '@/lib/utils'

interface TopAlphaDrawerProps {
  play: TopAlphaPlay | null
  onClose: () => void
}

export default function TopAlphaDrawer({ play, onClose }: TopAlphaDrawerProps) {
  const router = useRouter()

  // Lock body scroll while drawer/sheet is open
  useEffect(() => {
    if (!play) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [play])

  if (!play || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-end bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full md:max-w-lg h-auto max-h-[88dvh] md:max-h-full md:h-full bg-[#0A0F1A] border-t md:border-t-0 md:border-l border-[#1E293B] rounded-t-3xl md:rounded-none shadow-2xl p-5 sm:p-6 overflow-y-auto flex flex-col justify-between animate-in slide-in-from-bottom md:slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          {/* Mobile Bottom-Sheet Pull Handle */}
          <div
            className="md:hidden flex justify-center pb-3 -mt-1 cursor-pointer"
            onClick={onClose}
          >
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Drawer Header */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#1E293B]">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-geist-mono)] text-2xl sm:text-3xl font-black text-[#F1F5F9]">
                  {play.ticker}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-md font-bold font-[family-name:var(--font-geist-mono)] bg-[#00D4AA]/10 text-[#00D4AA] border border-[#00D4AA]/30">
                  RANK #{play.rank}
                </span>
                {play.archetype_label && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-bold font-[family-name:var(--font-geist-mono)] bg-[#141B2D] text-[#8B95A8] border border-white/10 hidden sm:inline">
                    {play.archetype_label}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-[#8B95A8] mt-1 font-medium">{play.stock_name}</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-xl bg-[#141B2D] border border-[#1E293B] text-[#8B95A8] hover:text-[#F1F5F9] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
              title="Close inspect panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 3-Column Micro Metrics Grid */}
          <div className="grid grid-cols-3 gap-2 py-3.5 border-b border-[#1E293B] font-[family-name:var(--font-geist-mono)] text-center">
            <div className="p-2.5 rounded-xl bg-[#141B2D]/70 border border-white/5">
              <span className="block text-[9px] uppercase tracking-wider text-[#64748B]">Aura Score</span>
              <span className="text-base sm:text-lg font-black text-[#00D4AA]">{play.aura_score}/100</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#141B2D]/70 border border-white/5">
              <span className="block text-[9px] uppercase tracking-wider text-[#64748B]">Agreement</span>
              <span className="text-base sm:text-lg font-black text-[#F1F5F9]">{play.agreement_pct}%</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#141B2D]/70 border border-white/5">
              <span className="block text-[9px] uppercase tracking-wider text-[#64748B]">Channels</span>
              <span className="text-base sm:text-lg font-black text-[#38BDF8]">{play.analyst_count}</span>
            </div>
          </div>

          {/* Executive Consensus Thesis */}
          <div className="py-3.5 border-b border-[#1E293B]">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#64748B] font-[family-name:var(--font-geist-mono)] mb-2">
              Executive Consensus Thesis
            </h4>
            <p className="text-xs sm:text-sm text-[#F1F5F9] leading-relaxed bg-[#141B2D]/40 p-3.5 rounded-xl border border-white/5 font-light">
              {play.executive_thesis}
            </p>
          </div>

          {/* Individual Analyst Catalysts & Quotes */}
          <div className="py-3.5 space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#64748B] font-[family-name:var(--font-geist-mono)]">
              Analyst Catalysts &amp; Transcripts ({play.catalysts?.length || 0})
            </h4>

            <div className="space-y-2.5">
              {play.catalysts && play.catalysts.length > 0 ? (
                play.catalysts.map((cat, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#141B2D]/50 border border-white/5 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between text-[11px] font-[family-name:var(--font-geist-mono)]">
                      <span className="font-bold text-[#00D4AA]">{cat.channel_name}</span>
                      <span className="text-[#64748B]">{cat.published_at ? formatRelativeTime(cat.published_at) : ''}</span>
                    </div>
                    <p className="text-[#CBD5E1] leading-relaxed italic">
                      &ldquo;{cat.notes}&rdquo;
                    </p>
                    {cat.youtube_video_id && (
                      <Link
                        href={`/video?id=${cat.youtube_video_id}`}
                        className="inline-flex items-center gap-1 text-[10px] text-[#38BDF8] hover:underline font-bold font-[family-name:var(--font-geist-mono)]"
                      >
                        <span>Watch YouTube Clip</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </Link>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#64748B]">No individual transcript quotes recorded for this ticker.</p>
              )}
            </div>
          </div>
        </div>

        {/* Drawer Bottom Actions with Safe-Area clearance for iOS */}
        <div className="pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-[#1E293B] shrink-0 mt-4">
          <button
            type="button"
            onClick={() => {
              onClose()
              router.push(`/ticker?s=${play.ticker}`)
            }}
            className="w-full py-3.5 px-4 rounded-xl bg-[#00D4AA] text-[#0A0F1A] font-black font-[family-name:var(--font-geist-mono)] text-xs tracking-wider uppercase hover:bg-[#00FFD0] transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,212,170,0.3)] min-h-[48px]"
          >
            <span>Open Full Ticker Dossier</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
