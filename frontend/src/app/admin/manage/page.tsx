'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Radio, Tv2, MessageSquareText, Brain, BarChart3 } from 'lucide-react'
import { ChannelsTab } from './tabs/channels-tab'
import { VideosTab } from './tabs/videos-tab'
import { RecommendationsTab } from './tabs/recommendations-tab'
import { LlmLogsTab } from './tabs/llm-logs-tab'
import { StatsTab } from './tabs/stats-tab'

// ─── Tab Config ───

const TABS = [
  { id: 'channels', label: 'Channels', icon: Radio, shortcut: '1' },
  { id: 'videos', label: 'Videos', icon: Tv2, shortcut: '2' },
  { id: 'recs', label: 'Recs', icon: MessageSquareText, shortcut: '3' },
  { id: 'llm', label: 'LLM', icon: Brain, shortcut: '4' },
  { id: 'stats', label: 'Stats', icon: BarChart3, shortcut: '5' },
] as const

type TabId = (typeof TABS)[number]['id']

// ─── Component ───

export default function AdminManagePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [authChecked, setAuthChecked] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('channels')

  // Sync tab from URL
  useEffect(() => {
    const tab = searchParams.get('tab') as TabId | null
    if (tab && TABS.some((t) => t.id === tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  // Auth guard
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/admin/login')
        return
      }

      const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || ''
      if (session.user.email?.toLowerCase() !== ownerEmail.toLowerCase()) {
        await supabase.auth.signOut()
        router.replace('/admin/login?error=not_owner')
        return
      }

      setAuthChecked(true)
    }
    checkAuth()
  }, [router])

  // Tab change handler — update URL
  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tab)
    window.history.replaceState({}, '', url.toString())
  }, [])

  // Keyboard shortcuts (1–5)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const idx = parseInt(e.key) - 1
      if (idx >= 0 && idx < TABS.length) {
        handleTabChange(TABS[idx].id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleTabChange])

  // Loading state
  if (!authChecked) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#00D4AA] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#8B95A8] font-mono">Authenticating...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1E293B] px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-[#8B95A8] hover:text-[#F1F5F9] transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Hub</span>
          </Link>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-[#F1F5F9]">
            Control Panel
          </h1>
        </div>
      </header>

      {/* Tab Bar */}
      <nav className="border-b border-[#1E293B] px-4 sm:px-6 overflow-x-auto scrollbar-hide">
        <div className="max-w-7xl mx-auto flex gap-1 relative">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  relative flex items-center gap-2 px-4 py-3 text-sm font-medium
                  whitespace-nowrap transition-colors rounded-t-md
                  ${isActive
                    ? 'text-[#00D4AA]'
                    : 'text-[#8B95A8] hover:text-[#F1F5F9]'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-[#8B95A8] bg-[#0A0F1A] border border-[#1E293B] rounded">
                  {tab.shortcut}
                </kbd>
                {/* Active indicator */}
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#00D4AA] rounded-full" />
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Tab Content */}
      <main className="flex-1 px-4 sm:px-6 py-6">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'channels' && <ChannelsTab />}
          {activeTab === 'videos' && <VideosTab />}
          {activeTab === 'recs' && <RecommendationsTab />}
          {activeTab === 'llm' && <LlmLogsTab />}
          {activeTab === 'stats' && <StatsTab />}
        </div>
      </main>
    </div>
  )
}
