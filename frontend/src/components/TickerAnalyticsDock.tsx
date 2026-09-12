'use client'

import React, { useState } from 'react'
import { LineChart, BarChart3, Building2, Terminal } from 'lucide-react'
import { TVMiniChart, TVCompanyProfile, TVFundamentalData } from '@/components/TVWidgets'

interface TickerAnalyticsDockProps {
  symbol: string
  sentiment?: number
}

type TabKey = 'chart' | 'financials' | 'profile'

export default function TickerAnalyticsDock({ symbol, sentiment }: TickerAnalyticsDockProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('chart')

  const tabs: { key: TabKey; label: string; icon: React.ElementType; color: string }[] = [
    { key: 'chart', label: 'Technicals & Price Action', icon: LineChart, color: '#00D4AA' },
    { key: 'financials', label: 'Valuation & Fundamentals', icon: BarChart3, color: '#3B82F6' },
    { key: 'profile', label: 'Company Profile & Sector', icon: Building2, color: '#A855F7' },
  ]

  return (
    <div className="w-full rounded-2xl bg-[#141B2D]/70 backdrop-blur-xl border border-white/5 shadow-2xl shadow-black/30 overflow-hidden mb-8">
      {/* Console Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-[#0A0F1A]/80 border-b border-[#1E293B]">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#00D4AA]" />
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#8B95A8] font-[family-name:var(--font-geist-mono)]">
            Market Analytics Terminal
          </span>
        </div>

        {/* Tab Navigation Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`
                  inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer font-[family-name:var(--font-geist-mono)]
                  ${
                    isActive
                      ? 'bg-[#1E293B] text-[#F1F5F9] border border-white/10 shadow-lg shadow-black/20'
                      : 'text-[#8B95A8] hover:text-[#F1F5F9] hover:bg-[#1E293B]/40 border border-transparent'
                  }
                `}
                style={{
                  borderLeftColor: isActive ? tab.color : undefined,
                  borderLeftWidth: isActive ? '2px' : undefined,
                }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: isActive ? tab.color : undefined }} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Console Screen / Body */}
      <div className="p-3 sm:p-5 relative min-h-[420px]">
        {/* We keep all 3 rendered with display none / block so TradingView widgets retain their iframe state without re-fetching */}
        <div className={activeTab === 'chart' ? 'block w-full h-full' : 'hidden'}>
          <div className="rounded-xl overflow-hidden bg-[#0A0F1A]/60 border border-[#1E293B]/60 shadow-inner">
            <TVMiniChart symbol={symbol} sentiment={sentiment} />
          </div>
        </div>

        <div className={activeTab === 'financials' ? 'block w-full h-full' : 'hidden'}>
          <div className="rounded-xl overflow-hidden bg-[#0A0F1A]/60 border border-[#1E293B]/60 p-2 sm:p-4">
            <TVFundamentalData symbol={symbol} />
          </div>
        </div>

        <div className={activeTab === 'profile' ? 'block w-full h-full' : 'hidden'}>
          <div className="rounded-xl overflow-hidden bg-[#0A0F1A]/60 border border-[#1E293B]/60 p-2 sm:p-4">
            <TVCompanyProfile symbol={symbol} />
          </div>
        </div>
      </div>
    </div>
  )
}
