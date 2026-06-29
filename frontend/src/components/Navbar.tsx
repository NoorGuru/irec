'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MoreHorizontal } from 'lucide-react'

interface TickerResult {
  ticker: string
  stock_name: string
}

/* ─── Command Palette (full-screen search) ─── */

function CommandPalette({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TickerResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [allTickers, setAllTickers] = useState<TickerResult[]>([])
  const [loaded, setLoaded] = useState(false)
  const [closing, setClosing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || loaded) return
    async function fetchTickers() {
      const supabase = createClient()
      const { data } = await supabase
        .from('recommendations')
        .select('ticker, stock_name')
      if (data) {
        const unique = new Map<string, string>()
        for (const row of data) {
          if (!unique.has(row.ticker)) {
            unique.set(row.ticker, row.stock_name || '')
          }
        }
        setAllTickers(
          Array.from(unique.entries())
            .map(([ticker, stock_name]) => ({ ticker, stock_name }))
            .sort((a, b) => a.ticker.localeCompare(b.ticker))
        )
        setLoaded(true)
      }
    }
    fetchTickers()
  }, [open, loaded])

  useEffect(() => {
    if (!query.trim()) {
      setResults(allTickers.slice(0, 8))
      setSelectedIndex(0)
      return
    }
    const q = query.toLowerCase()
    const filtered = allTickers
      .filter(
        (t) =>
          t.ticker.toLowerCase().includes(q) ||
          t.stock_name.toLowerCase().includes(q)
      )
      .slice(0, 8)
    setResults(filtered)
    setSelectedIndex(filtered.length > 0 ? 0 : -1)
  }, [query, allTickers])

  useEffect(() => {
    if (open && !closing) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, closing])

  useEffect(() => {
    if (open) setClosing(false)
  }, [open])

  const handleClose = useCallback(() => {
    setClosing(true)
    setTimeout(() => {
      onClose()
      setClosing(false)
    }, 250)
  }, [onClose])

  const navigate = useCallback(
    (ticker: string) => {
      router.push(`/ticker?s=${ticker}`)
      handleClose()
      setQuery('')
    },
    [router, handleClose]
  )

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && results[selectedIndex]) {
        navigate(results[selectedIndex].ticker)
      } else if (query.trim()) {
        navigate(query.trim().toUpperCase())
      }
    } else if (e.key === 'Escape') {
      handleClose()
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-16 md:pt-[20vh] px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div className={`absolute inset-0 bg-[#0A0F1A]/90 backdrop-blur-md ${closing ? 'cmd-backdrop-out' : 'cmd-backdrop'}`} />

      <div className={`relative w-full max-w-lg ${closing ? 'cmd-panel-out' : 'cmd-panel'}`}>
        <div className="md:hidden flex items-center justify-between mb-4">
          <span className="font-[family-name:var(--font-geist-mono)] text-base font-extralight tracking-[0.3em] logo-sweep">
            <span className="logo-letter">aura</span>
          </span>
          <button
            onClick={handleClose}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-[#00D4AA] border border-[#00D4AA]/20 bg-[#00D4AA]/5 active:bg-[#00D4AA]/10 active:scale-95 transition-all duration-150"
          >
            Cancel
          </button>
        </div>

        <div className="relative">
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#00D4AA]/20 via-[#00D4AA]/5 to-[#00D4AA]/20 blur-xl pointer-events-none cmd-glow" />
          <div className="relative flex items-center rounded-2xl border border-[#00D4AA]/20 bg-[#141B2D] shadow-2xl shadow-[#00D4AA]/5 overflow-hidden cmd-input-ring">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="ml-5 text-[#00D4AA] shrink-0">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search any ticker…"
              className="flex-1 bg-transparent px-4 py-5 text-lg md:text-xl text-[#F1F5F9] placeholder:text-[#475569] font-[family-name:var(--font-geist-mono)] outline-none tracking-wide"
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="cmd-results"
              aria-activedescendant={selectedIndex >= 0 ? `cmd-result-${selectedIndex}` : undefined}
            />
            <kbd className="hidden md:flex items-center mr-4 px-2 py-1 rounded-md bg-[#0A0F1A] border border-[#1E293B] font-[family-name:var(--font-geist-mono)] text-[10px] text-[#475569]">
              ESC
            </kbd>
          </div>
        </div>

        {results.length > 0 && (
          <ul id="cmd-results" role="listbox" className="mt-3 rounded-xl border border-[#1E293B] bg-[#141B2D]/95 backdrop-blur-sm shadow-2xl overflow-hidden">
            {results.map((result, i) => (
              <li
                key={result.ticker}
                id={`cmd-result-${i}`}
                role="option"
                aria-selected={i === selectedIndex}
                onClick={() => navigate(result.ticker)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`cmd-result-item flex items-center justify-between px-5 py-3.5 cursor-pointer transition-all duration-100 ${i === selectedIndex ? 'bg-[#00D4AA]/8 border-l-2 border-l-[#00D4AA]' : 'border-l-2 border-l-transparent hover:bg-[#0A0F1A]/40'
                  }`}
              >
                <div className="flex items-center gap-4">
                  <span className={`font-[family-name:var(--font-geist-mono)] text-base font-bold tracking-wider transition-colors duration-100 ${i === selectedIndex ? 'text-[#00D4AA]' : 'text-[#F1F5F9]'}`}>
                    {result.ticker}
                  </span>
                  {result.stock_name && (
                    <span className="text-sm text-[#64748B] truncate max-w-[200px]">
                      {result.stock_name}
                    </span>
                  )}
                </div>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={`shrink-0 transition-all duration-150 ${i === selectedIndex ? 'opacity-100 text-[#00D4AA] translate-x-0' : 'opacity-0 -translate-x-2'}`}>
                  <path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </li>
            ))}
          </ul>
        )}

        {query.trim() && results.length === 0 && loaded && (
          <div className="mt-3 rounded-xl border border-[#1E293B] bg-[#141B2D]/95 p-6 text-center cmd-result-item">
            <p className="font-[family-name:var(--font-geist-mono)] text-sm text-[#64748B]">
              No match — Enter to look up <span className="text-[#F1F5F9] font-bold">{query.toUpperCase()}</span>
            </p>
          </div>
        )}

        <p className="hidden md:block mt-4 text-center text-[11px] text-[#374151] font-[family-name:var(--font-geist-mono)] tracking-wide">
          ↑↓ navigate · ↵ select · esc close
        </p>
        <p className="md:hidden mt-4 text-center text-[11px] text-[#374151]">
          Tap a result or press Cancel to close
        </p>
      </div>
    </div>
  )
}

/* ─── Main Navbar ─── */

export function Navbar() {
  const pathname = usePathname()
  const [searchOpen, setSearchOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  // Close more menu on navigation
  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  if (pathname?.startsWith('/admin')) return null

  const allLinks = [
    { href: '/', label: 'Home', icon: DashboardIcon },
    { href: '/stocks', label: 'Stocks', icon: StocksIcon },
    { href: '/explore', label: 'Explore', icon: ExploreIcon },
    { href: '/today', label: "Today", icon: TodayPlaysIcon },
    { href: '/radars', label: 'Radars', icon: RadarsIcon },
    { href: '/channels', label: 'Channels', icon: ChannelsIcon },
    { href: '/videos', label: 'Videos', icon: VideosIcon },
  ]

  const mobilePrimaryLinks = [
    { href: '/', label: 'Home', icon: DashboardIcon },
    { href: '/stocks', label: 'Stocks', icon: StocksIcon },
    { href: '/today', label: "Today", icon: TodayPlaysIcon },
  ]
  const mobileMoreLinks = [
    { href: '/explore', label: 'Explore', icon: ExploreIcon },
    { href: '/radars', label: 'Radars', icon: RadarsIcon },
    { href: '/channels', label: 'Channels', icon: ChannelsIcon },
    { href: '/videos', label: 'Videos', icon: VideosIcon },
  ]

  return (
    <>
      <nav
        className={`hidden md:block sticky top-0 z-50 w-full transition-all duration-300 ${scrolled ? 'bg-[#0A0F1A]/95 backdrop-blur-xl border-b border-[#1E293B]/50 shadow-lg shadow-black/20' : 'bg-transparent border-b border-transparent'
          }`}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="max-w-6xl mx-auto px-8">
          <div className="flex items-center justify-between h-[72px]">
            <Link href="/" className="group shrink-0">
              <span className="font-[family-name:var(--font-geist-mono)] text-2xl font-extralight tracking-[0.3em] logo-sweep">
                <span className="logo-letter">aura</span>
              </span>
            </Link>

            <div className="flex items-center gap-0.5 rounded-full border border-[#1E293B]/80 bg-[#141B2D]/50 px-1.5 py-1.5">
              {allLinks.map((link) => {
                const isActive = link.href === '/' ? pathname === '/' : pathname?.startsWith(link.href)
                const Icon = link.icon
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => {
                      if (link.href === '/today') {
                        sessionStorage.removeItem('today_sortBy')
                        sessionStorage.removeItem('today_activeTab')
                        sessionStorage.removeItem('today_viewMode')
                        sessionStorage.removeItem('today_streamIndex')
                      }
                    }}
                    className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${isActive ? 'bg-[#0A0F1A] text-[#F1F5F9] shadow-sm shadow-black/20' : 'text-[#64748B] hover:text-[#C8D1DE]'
                      }`}
                  >
                    <Icon active={!!isActive} />
                    <span>{link.label}</span>
                    {link.href === '/today' && (
                      <span className="relative flex h-1.5 w-1.5 rounded-full bg-[#00D4AA] shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D4AA] opacity-75"></span>
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>

            <button
              onClick={() => setSearchOpen(true)}
              className="group flex items-center gap-2.5 px-3.5 py-2 rounded-full border border-[#1E293B]/80 bg-[#141B2D]/40 hover:border-[#00D4AA]/30 hover:bg-[#141B2D] transition-all duration-200"
              aria-label="Search tickers (⌘K)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-[#64748B] group-hover:text-[#00D4AA] transition-colors">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
                <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="text-sm text-[#64748B] group-hover:text-[#8B95A8] transition-colors">Search</span>
              <kbd className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#0A0F1A] border border-[#1E293B] font-[family-name:var(--font-geist-mono)] text-[10px] text-[#374151]">
                ⌘K
              </kbd>
            </button>
          </div>
        </div>
      </nav>

      <div className="md:hidden sticky top-0 z-50 w-full h-8 flex items-center justify-center border-b border-[#1E293B]/30 bg-[#0A0F1A]/90 backdrop-blur-lg">
        <Link href="/">
          <span className="font-[family-name:var(--font-geist-mono)] text-base font-extralight tracking-[0.3em] logo-sweep">
            <span className="logo-letter">aura</span>
          </span>
        </Link>
      </div>

      {/* Mobile Backdrop for More Menu */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/5 backdrop-blur-[2px]"
          onClick={() => setMoreOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Bottom Navigation Area */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-[#0A0F1A]/95 backdrop-blur-xl border-t border-[#1E293B]/60 safe-area-bottom shadow-[0_-8px_30px_rgba(0,0,0,0.5)] transition-all duration-300" role="navigation" aria-label="Mobile navigation">

        {/* Secondary Navigation Row (More Menu) */}
        {moreOpen && (
          <div className="flex items-center justify-around h-14 px-2 border-b border-[#1E293B]/40 animate-in slide-in-from-bottom-2 fade-in duration-200">
            {mobileMoreLinks.map((link) => {
              const isActive = pathname?.startsWith(link.href)
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex flex-col items-center justify-center gap-0.5 px-4 py-1 h-full w-full rounded-lg transition-colors ${isActive ? 'text-[#00D4AA]' : 'text-[#64748B] hover:text-[#F1F5F9]'}`}
                >
                  <div className="relative">
                    <Icon active={!!isActive} />
                  </div>
                  <span className="text-[10px] font-medium tracking-wide">{link.label}</span>
                </Link>
              )
            })}
          </div>
        )}

        {/* Primary Navigation Row */}
        <div className="flex items-center justify-around h-14 px-2 relative z-50">
          {mobilePrimaryLinks.map((link) => {
            const isActive = link.href === '/' ? pathname === '/' : pathname?.startsWith(link.href)
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => {
                  if (link.href === '/today') {
                    sessionStorage.removeItem('today_sortBy')
                    sessionStorage.removeItem('today_activeTab')
                    sessionStorage.removeItem('today_viewMode')
                    sessionStorage.removeItem('today_streamIndex')
                  }
                  setMoreOpen(false)
                }}
                className={`flex flex-col items-center justify-center gap-0.5 px-4 py-1 h-full w-full rounded-lg transition-colors ${isActive ? 'text-[#00D4AA]' : 'text-[#64748B] hover:text-[#F1F5F9]'}`}
              >
                <div className="relative">
                  <Icon active={!!isActive} />
                  {link.href === '/today' && (
                    <span className="absolute -top-1 -right-1 flex h-1.5 w-1.5 rounded-full bg-[#00D4AA]">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D4AA] opacity-75"></span>
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium tracking-wide">{link.label}</span>
              </Link>
            )
          })}
          <button
            onClick={() => {
              setSearchOpen(true)
              setMoreOpen(false)
            }}
            className="flex flex-col items-center justify-center gap-0.5 px-4 py-1 h-full w-full rounded-lg text-[#64748B] hover:text-[#F1F5F9] transition-colors"
            aria-label="Search"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-current">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-[10px] font-medium tracking-wide">Search</span>
          </button>
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex flex-col items-center justify-center gap-0.5 px-4 py-1 h-full w-full rounded-lg transition-colors ${moreOpen ? 'text-[#00D4AA]' : 'text-[#64748B] hover:text-[#F1F5F9]'}`}
            aria-label="More options"
          >
            <MoreHorizontal className="w-[18px] h-[18px]" />
            <span className="text-[10px] font-medium tracking-wide">More</span>
          </button>
        </div>
      </div>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}

/* ─── Icons ─── */

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className={active ? 'text-[#00D4AA]' : 'text-current'}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function ExploreIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className={active ? 'text-[#00D4AA]' : 'text-current'}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path d="m16.24 7.76-1.804 7.152a2 2 0 0 1-1.528 1.528l-7.152 1.804 1.804-7.152a2 2 0 0 1 1.528-1.528z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChannelsIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className={active ? 'text-[#00D4AA]' : 'text-current'}>
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 21v-2a4 4 0 014-4h6a4 4 0 014 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="19" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M22 21v-1a3 3 0 00-3-3h-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function VideosIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className={active ? 'text-[#00D4AA]' : 'text-current'}>
      <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 9l5 3-5 3V9z" fill="currentColor" />
    </svg>
  )
}

function TodayPlaysIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className={`${active ? 'text-[#00D4AA]' : 'text-current'} today-pulse-icon`}>
      <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill={active ? 'currentColor' : 'none'} />
    </svg>
  )
}

function RadarsIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className={active ? 'text-[#00D4AA]' : 'text-current'}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path d="M12 2L12 6M12 18L12 22M2 12L6 12M18 12L22 12" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <path d="M12 12L18 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function StocksIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className={active ? 'text-[#00D4AA]' : 'text-current'}>
      <path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 14l4-4 4 4 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
