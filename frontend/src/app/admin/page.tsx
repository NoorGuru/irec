'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getRandomQuote } from '@/lib/quotes'
import {
  LogOut,
  Zap,
  Radio,
  ExternalLink,
  Database,
  Cloud,
  Globe,
  GitFork,
  Brain,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  CreditCard,
  ChevronDown,
  ChevronRight,
  Play,
  Clock,
  RefreshCw,
} from 'lucide-react'

// ─── Types ───

interface ServiceStatus {
  name: string
  status: 'checking' | 'online' | 'offline'
  latency?: number
  href: string
}

interface RecentVideo {
  youtube_video_id: string
  title: string
  channel_name: string
  extracted_at: string
  recommendation_count: number
}

interface ChannelScout {
  channel_id: string
  channel_name: string
  youtube_channel_id: string | null
  total_videos: number
  last_ingested: string | null
}

// ─── Config ───

const SUPABASE_PROJECT_REF = 'deasjnsdrhnsxqssfbrn'
const GCP_PROJECT = 'irec-backend'
const GCP_REGION = 'us-central1'
const GITHUB_REPO = 'NoorGuru/irec'
const PRODUCTION_URL = 'https://aura.bynoor.io'

interface InfraLink {
  label: string
  description: string
  href: string
  icon: typeof Database
  accent: string
}

interface InfraGroup {
  category: string
  links: InfraLink[]
}

const INFRA_LINKS: InfraGroup[] = [
  {
    category: 'Data & Auth',
    links: [
      {
        label: 'Supabase',
        description: 'Database, Auth, RLS policies',
        href: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}`,
        icon: Database,
        accent: '#3ECF8E',
      },
      {
        label: 'Table Editor',
        description: 'Browse and edit rows directly',
        href: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/editor`,
        icon: Database,
        accent: '#3ECF8E',
      },
      {
        label: 'SQL Editor',
        description: 'Run queries and migrations',
        href: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/sql/new`,
        icon: Database,
        accent: '#3ECF8E',
      },
    ],
  },
  {
    category: 'Compute',
    links: [
      {
        label: 'Cloud Run',
        description: 'Backend service, logs, revisions',
        href: `https://console.cloud.google.com/run/detail/${GCP_REGION}/${GCP_PROJECT}/metrics`,
        icon: Cloud,
        accent: '#4285F4',
      },
      {
        label: 'Cloudflare Workers',
        description: 'Transcript proxy worker',
        href: 'https://dash.cloudflare.com/',
        icon: Globe,
        accent: '#F6821F',
      },
    ],
  },
  {
    category: 'Source & CI',
    links: [
      {
        label: 'GitHub Repo',
        description: 'Source code and issues',
        href: `https://github.com/${GITHUB_REPO}`,
        icon: GitFork,
        accent: '#F1F5F9',
      },
      {
        label: 'Actions',
        description: 'CI/CD pipeline status',
        href: `https://github.com/${GITHUB_REPO}/actions`,
        icon: Activity,
        accent: '#F1F5F9',
      },
      {
        label: 'Secrets',
        description: 'Environment variables & keys',
        href: `https://github.com/${GITHUB_REPO}/settings/secrets/actions`,
        icon: GitFork,
        accent: '#F1F5F9',
      },
    ],
  },
  {
    category: 'AI & Proxies',
    links: [
      {
        label: 'Anthropic Console',
        description: 'API usage, billing, keys',
        href: 'https://console.anthropic.com',
        icon: Brain,
        accent: '#D4A574',
      },
      {
        label: 'Google Cloud Console',
        description: 'YouTube Data API quota',
        href: 'https://console.cloud.google.com/apis/dashboard',
        icon: Cloud,
        accent: '#4285F4',
      },
    ],
  },
  {
    category: 'Billing',
    links: [
      {
        label: 'Supabase Billing',
        description: 'Plan, usage, invoices',
        href: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/settings/billing/usage`,
        icon: CreditCard,
        accent: '#3ECF8E',
      },
      {
        label: 'GCP Billing',
        description: 'Cloud Run & API costs',
        href: 'https://console.cloud.google.com/billing',
        icon: CreditCard,
        accent: '#4285F4',
      },
      {
        label: 'Cloudflare Billing',
        description: 'Workers usage & plan',
        href: 'https://dash.cloudflare.com/?to=/:account/billing',
        icon: CreditCard,
        accent: '#F6821F',
      },
      {
        label: 'Anthropic Billing',
        description: 'API spend & limits',
        href: 'https://console.anthropic.com/settings/billing',
        icon: CreditCard,
        accent: '#D4A574',
      },
      {
        label: 'Webshare',
        description: 'Proxy bandwidth & subscription',
        href: 'https://dashboard.webshare.io/subscription',
        icon: CreditCard,
        accent: '#6366F1',
      },
      {
        label: 'GitHub Billing',
        description: 'Actions minutes & storage',
        href: 'https://github.com/settings/billing/summary',
        icon: CreditCard,
        accent: '#F1F5F9',
      },
    ],
  },
]

// ─── Helpers ───

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '—'
  const diff = Date.now() - date.getTime()
  if (diff < 0) return '—'
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return '1d ago'
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Returns a freshness label + color based on how recently a channel was ingested */
function getFreshnessLevel(lastIngested: string | null): { label: string; color: string } {
  if (!lastIngested) return { label: 'Never', color: '#FF4D6A' }
  const diff = Date.now() - new Date(lastIngested).getTime()
  const days = diff / (1000 * 60 * 60 * 24)
  if (days < 3) return { label: 'Fresh', color: '#00D4AA' }
  if (days < 7) return { label: 'Recent', color: '#00D4AA80' }
  if (days < 14) return { label: 'Aging', color: '#F59E0B' }
  if (days < 30) return { label: 'Stale', color: '#F97316' }
  return { label: 'Cold', color: '#FF4D6A' }
}

// ─── Component ───

export default function AdminHubPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'Backend', status: 'checking', href: `${process.env.NEXT_PUBLIC_BACKEND_URL || 'https://irec-backend-f5xyrqhyjq-uc.a.run.app'}/api/v1/version` },
    { name: 'Worker', status: 'checking', href: 'https://yt-transcript-proxy.abukhleif94.workers.dev' },
  ])
  const [recentVideos, setRecentVideos] = useState<RecentVideo[]>([])
  const [channels, setChannels] = useState<ChannelScout[]>([])
  const [recentVideosOpen, setRecentVideosOpen] = useState(false)
  const [channelsOpen, setChannelsOpen] = useState(false)
  const [infraOpen, setInfraOpen] = useState(false)
  const healthChecked = useRef(false)

  const [clearingCache, setClearingCache] = useState(false)

  const handleClearCache = async () => {
    setClearingCache(true)
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const res = await fetch(`${backendUrl}/api/v1/admin/cache/clear`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to clear cache')
      alert('Cache cleared! Users will see fresh data immediately on their next visit.')
    } catch (err) {
      alert('Failed to clear cache: ' + err)
    } finally {
      setClearingCache(false)
    }
  }

  // Auth check
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

      const meta = session.user.user_metadata
      const firstName = (meta?.full_name || meta?.name || '').split(' ')[0]
      setDisplayName(firstName || session.user.email?.split('@')[0] || null)
      setAuthChecked(true)
    }
    checkAuth()
  }, [router])

  // Health checks + recent videos
  useEffect(() => {
    if (!authChecked || healthChecked.current) return
    healthChecked.current = true

    const checkHealth = async (name: string, url: string, acceptNon5xx = false) => {
      const start = Date.now()
      try {
        const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(8000) })
        const latency = Date.now() - start
        const isUp = acceptNon5xx ? res.status < 500 : res.ok
        setServices(prev =>
          prev.map(s => s.name === name ? { ...s, status: isUp ? 'online' : 'offline', latency } : s)
        )
      } catch {
        setServices(prev =>
          prev.map(s => s.name === name ? { ...s, status: 'offline' } : s)
        )
      }
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || ''
    if (backendUrl) {
      checkHealth('Backend', `${backendUrl}/api/v1/version`)
    }
    checkHealth('Worker', 'https://yt-transcript-proxy.abukhleif94.workers.dev', true)

    // Fetch recent videos
    const fetchRecent = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('videos')
        .select(`
          youtube_video_id,
          title,
          extracted_at,
          channels!inner(channel_name),
          recommendations(ticker)
        `)
        .order('extracted_at', { ascending: false })
        .limit(5)

      if (data) {
        setRecentVideos(
          data.map((v: Record<string, unknown>) => ({
            youtube_video_id: v.youtube_video_id as string,
            title: (v.title as string) || 'Untitled',
            channel_name: (v.channels as Record<string, string>)?.channel_name || 'Unknown',
            extracted_at: v.extracted_at as string,
            recommendation_count: Array.isArray(v.recommendations) ? v.recommendations.length : 0,
          }))
        )
      }
    }
    fetchRecent()

    // Fetch channels with last ingested date
    const fetchChannels = async () => {
      const supabase = createClient()
      const { data: channelData } = await supabase
        .from('channels')
        .select('channel_id, channel_name, youtube_channel_id')
        .order('channel_name')

      if (!channelData || channelData.length === 0) return

      // Get the latest video per channel
      const { data: videoData } = await supabase
        .from('videos')
        .select('channel_id, extracted_at')
        .order('extracted_at', { ascending: false })

      const lastIngestedMap = new Map<string, string>()
      const videoCountMap = new Map<string, number>()
      if (videoData) {
        for (const v of videoData) {
          const cid = v.channel_id as string
          videoCountMap.set(cid, (videoCountMap.get(cid) || 0) + 1)
          if (!lastIngestedMap.has(cid)) {
            lastIngestedMap.set(cid, v.extracted_at as string)
          }
        }
      }

      setChannels(
        channelData.map((ch: Record<string, unknown>) => ({
          channel_id: ch.channel_id as string,
          channel_name: ch.channel_name as string,
          youtube_channel_id: (ch.youtube_channel_id as string) || null,
          total_videos: videoCountMap.get(ch.channel_id as string) || 0,
          last_ingested: lastIngestedMap.get(ch.channel_id as string) || null,
        })).sort((a, b) => {
          // Sort by staleness: channels not ingested recently first
          if (!a.last_ingested && !b.last_ingested) return 0
          if (!a.last_ingested) return -1
          if (!b.last_ingested) return 1
          return new Date(a.last_ingested).getTime() - new Date(b.last_ingested).getTime()
        })
      )
    }
    fetchChannels()
  }, [authChecked])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/admin/login')
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0F1A]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-5 w-5 animate-spin text-[#00D4AA]/60" />
          <p className="text-xs text-[#64748B] tracking-wide">Verifying session...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0A0F1A]">
      {/* ─── Top bar ─── */}
      <header className="sticky top-0 z-50 border-b border-[#1E293B]/60 bg-[#0A0F1A]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-extralight tracking-[0.2em] text-[#F1F5F9]/60 hover:text-[#F1F5F9] transition-colors">
              aura
            </Link>
            <span className="text-[#1E293B]">/</span>
            <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[#00D4AA]/70 tracking-wider">
              admin
            </span>
          </div>
          <div className="flex items-center gap-3">
            {displayName && (
              <span className="hidden sm:inline text-[11px] text-[#64748B] font-[family-name:var(--font-geist-mono)]">
                {displayName}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-[#8B95A8] hover:text-[#F1F5F9] hover:bg-[#141B2D] transition-all"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main content ─── */}
      <main className="flex-1 px-5 py-10 md:py-16">
        <div className="mx-auto max-w-4xl space-y-10">

          {/* ─── Personal greeting — the signature moment ─── */}
          <div className="animate-hero-rise relative">
            {/* Ambient glow behind the greeting */}
            <div
              className="pointer-events-none absolute -left-8 -top-10 h-40 w-80 rounded-full opacity-60"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(0, 212, 170, 0.08) 0%, rgba(0, 255, 208, 0.03) 40%, transparent 70%)',
                animation: 'greeting-glow 6s ease-in-out infinite',
              }}
              aria-hidden="true"
            />

            {/* Main greeting — oversized, gradient, alive */}
            <h1 className="relative text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight">
              <span className="greeting-wave inline-block">{getGreeting()}</span>
              {displayName && (
                <>
                  <span className="text-[#475569]">, </span>
                  <span className="greeting-name-gradient">{displayName}</span>
                </>
              )}
            </h1>

            {/* Daily quote — personal & rotating */}
            <QuoteCard />

            {/* Decorative pulse line */}
            <div className="greeting-stagger-3 mt-6 h-[2px] w-24 rounded-full overflow-hidden bg-[#1E293B]">
              <div className="h-full w-full rounded-full greeting-line-fill" />
            </div>
          </div>

          {/* ─── Primary CTAs ─── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/admin/ingest"
              className="group relative block rounded-2xl border border-[#00D4AA]/15 bg-gradient-to-br from-[#141B2D] to-[#0F1623] p-6 sm:p-8 hover:border-[#00D4AA]/35 transition-all duration-500 animate-fade-up stagger-1 overflow-hidden"
            >
              {/* Warm background glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse at 20% 50%, rgba(0, 212, 170, 0.05) 0%, transparent 60%)',
                }}
                aria-hidden="true"
              />
              <div className="relative flex items-center gap-4 sm:gap-6">
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-[#00D4AA]/8 border border-[#00D4AA]/15 group-hover:bg-[#00D4AA]/12 group-hover:border-[#00D4AA]/25 transition-all duration-500">
                  <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-[#00D4AA]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-semibold text-[#F1F5F9] group-hover:text-[#00D4AA] transition-colors duration-300">
                    Ingest a video
                  </h2>
                  <p className="mt-1 text-sm text-[#8B95A8] group-hover:text-[#8B95A8]/80 transition-colors">
                    Extract plays in seconds
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-[#475569] group-hover:text-[#00D4AA] group-hover:translate-x-1 transition-all duration-300 shrink-0 hidden sm:block" />
              </div>
            </Link>

            <button
              onClick={handleClearCache}
              disabled={clearingCache}
              className="group relative text-left block w-full rounded-2xl border border-[#FF4D6A]/15 bg-gradient-to-br from-[#141B2D] to-[#0F1623] p-6 sm:p-8 hover:border-[#FF4D6A]/35 transition-all duration-500 animate-fade-up stagger-1 overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse at 20% 50%, rgba(255, 77, 106, 0.05) 0%, transparent 60%)',
                }}
                aria-hidden="true"
              />
              <div className="relative flex items-center gap-4 sm:gap-6">
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FF4D6A]/8 border border-[#FF4D6A]/15 group-hover:bg-[#FF4D6A]/12 group-hover:border-[#FF4D6A]/25 transition-all duration-500">
                  {clearingCache ? <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin text-[#FF4D6A]" /> : <RefreshCw className="h-5 w-5 sm:h-6 sm:w-6 text-[#FF4D6A]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-semibold text-[#F1F5F9] group-hover:text-[#FF4D6A] transition-colors duration-300">
                    Force Recalculate
                  </h2>
                  <p className="mt-1 text-sm text-[#8B95A8] group-hover:text-[#8B95A8]/80 transition-colors">
                    Wipe cache & enforce updates
                  </p>
                </div>
              </div>
            </button>
          </div>

          {/* ─── Service health ─── */}
          <div className="flex items-center justify-end gap-4 animate-fade-up stagger-1">
            {services.map((service) => (
              <a
                key={service.name}
                href={service.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                title={service.latency ? `${service.name}: ${service.latency}ms` : service.name}
              >
                {service.status === 'checking' && (
                  <div className="h-2 w-2 rounded-full bg-[#8B95A8] animate-pulse" />
                )}
                {service.status === 'online' && (
                  <div className="h-2 w-2 rounded-full bg-[#00D4AA]" />
                )}
                {service.status === 'offline' && (
                  <div className="h-2 w-2 rounded-full bg-[#FF4D6A]" />
                )}
                <span className="text-[11px] text-[#64748B] font-[family-name:var(--font-geist-mono)]">
                  {service.name}
                </span>
              </a>
            ))}
          </div>

          {/* ─── Quick links row ─── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 animate-fade-up stagger-2">
            <Link
              href="/admin/manage"
              className="group rounded-2xl border border-[#00D4AA]/20 bg-gradient-to-br from-[#141B2D] to-[#0F1623] p-4 hover:border-[#00D4AA]/40 hover:bg-[#141B2D]/60 transition-all duration-300"
            >
              <Zap className="h-4 w-4 text-[#00D4AA]/70 mb-2.5 group-hover:text-[#00D4AA] transition-colors duration-300" />
              <p className="text-sm font-medium text-[#F1F5F9]">Control Panel</p>
              <p className="text-[11px] text-[#64748B] mt-0.5">Manage everything</p>
            </Link>
            <Link
              href="/"
              className="group rounded-2xl border border-[#1E293B]/80 bg-[#141B2D]/30 p-4 hover:border-[#2D3A4F] hover:bg-[#141B2D]/60 transition-all duration-300"
            >
              <Activity className="h-4 w-4 text-[#8B95A8]/60 mb-2.5 group-hover:text-[#00D4AA] transition-colors duration-300" />
              <p className="text-sm font-medium text-[#F1F5F9]">Dashboard</p>
              <p className="text-[11px] text-[#64748B] mt-0.5">The public view</p>
            </Link>
            <Link
              href="/channels"
              className="group rounded-2xl border border-[#1E293B]/80 bg-[#141B2D]/30 p-4 hover:border-[#2D3A4F] hover:bg-[#141B2D]/60 transition-all duration-300"
            >
              <Radio className="h-4 w-4 text-[#8B95A8]/60 mb-2.5 group-hover:text-[#00D4AA] transition-colors duration-300" />
              <p className="text-sm font-medium text-[#F1F5F9]">Channels</p>
              <p className="text-[11px] text-[#64748B] mt-0.5">Your analysts</p>
            </Link>
            <a
              href={PRODUCTION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl border border-[#1E293B]/80 bg-[#141B2D]/30 p-4 hover:border-[#2D3A4F] hover:bg-[#141B2D]/60 transition-all duration-300"
            >
              <Globe className="h-4 w-4 text-[#8B95A8]/60 mb-2.5 group-hover:text-[#00D4AA] transition-colors duration-300" />
              <p className="text-sm font-medium text-[#F1F5F9] flex items-center gap-1">
                Live site
                <ExternalLink className="h-3 w-3 text-[#475569]" />
              </p>
              <p className="text-[11px] text-[#64748B] mt-0.5">aura.bynoor.io</p>
            </a>
            <a
              href={`https://github.com/${GITHUB_REPO}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl border border-[#1E293B]/80 bg-[#141B2D]/30 p-4 hover:border-[#2D3A4F] hover:bg-[#141B2D]/60 transition-all duration-300"
            >
              <GitFork className="h-4 w-4 text-[#8B95A8]/60 mb-2.5 group-hover:text-[#00D4AA] transition-colors duration-300" />
              <p className="text-sm font-medium text-[#F1F5F9] flex items-center gap-1">
                GitHub
                <ExternalLink className="h-3 w-3 text-[#475569]" />
              </p>
              <p className="text-[11px] text-[#64748B] mt-0.5">Source & CI</p>
            </a>
          </div>

          {/* ─── Recent Activity ─── */}
          {recentVideos.length > 0 && (
            <section className="animate-fade-up stagger-3 space-y-3">
              <button
                onClick={() => setRecentVideosOpen(!recentVideosOpen)}
                className="flex items-center justify-between w-full text-left group py-3 px-4 rounded-xl hover:bg-[#141B2D]/40 border border-transparent hover:border-[#1E293B]/60 transition-all duration-300"
                aria-expanded={recentVideosOpen}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#141B2D]/50 border border-[#1E293B]/60 group-hover:border-[#00D4AA]/30 group-hover:bg-[#00D4AA]/5 transition-all duration-300">
                    <Clock className="h-4.5 w-4.5 text-[#64748B] group-hover:text-[#00D4AA] transition-colors duration-300" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold text-[#F1F5F9] group-hover:text-white transition-colors duration-300">
                      Your recent extractions
                    </h2>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[#475569] group-hover:text-[#00D4AA]/70 transition-colors">
                  <span className="text-xs font-[family-name:var(--font-geist-mono)] bg-[#141B2D]/80 px-2.5 py-1 rounded-lg border border-[#1E293B]/60 group-hover:border-[#00D4AA]/20 transition-colors">
                    {recentVideos.length}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 transition-transform duration-300 ${
                      recentVideosOpen ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </div>
              </button>

              {recentVideosOpen && (
                <div className="rounded-xl border border-[#1E293B] bg-[#141B2D]/40 divide-y divide-[#1E293B]/60 animate-[fade-in_0.2s_ease-out]">
                  {recentVideos.map((video) => (
                    <Link
                      key={video.youtube_video_id}
                      href={`/video?id=${video.youtube_video_id}`}
                      className="group flex items-center gap-4 px-5 py-3.5 hover:bg-[#141B2D] transition-colors first:rounded-t-xl last:rounded-b-xl"
                    >
                      <Play className="h-3.5 w-3.5 text-[#475569] group-hover:text-[#00D4AA] transition-colors shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#F1F5F9] truncate group-hover:text-[#00D4AA] transition-colors">
                          {video.title}
                        </p>
                        <p className="text-[11px] text-[#64748B] mt-0.5">
                          {video.channel_name} · {video.recommendation_count} rec{video.recommendation_count !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className="text-[11px] text-[#475569] font-[family-name:var(--font-geist-mono)] shrink-0">
                        {timeAgo(video.extracted_at)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ─── Channel Scout: Check for new uploads ─── */}
          {channels.length > 0 && (
            <section className="animate-fade-up stagger-4 space-y-3">
              <button
                onClick={() => setChannelsOpen(!channelsOpen)}
                className="flex items-center justify-between w-full text-left group py-3 px-4 rounded-xl hover:bg-[#141B2D]/40 border border-transparent hover:border-[#1E293B]/60 transition-all duration-300"
                aria-expanded={channelsOpen}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#141B2D]/50 border border-[#1E293B]/60 group-hover:border-[#00D4AA]/30 group-hover:bg-[#00D4AA]/5 transition-all duration-300">
                    <Radio className="h-4.5 w-4.5 text-[#64748B] group-hover:text-[#00D4AA] transition-colors duration-300" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold text-[#F1F5F9] group-hover:text-white transition-colors duration-300">
                      Channels you follow
                    </h2>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[#475569] group-hover:text-[#00D4AA]/70 transition-colors">
                  <span className="hidden sm:inline text-xs text-[#475569]">
                    Needs attention first
                  </span>
                  <span className="text-xs font-[family-name:var(--font-geist-mono)] bg-[#141B2D]/80 px-2.5 py-1 rounded-lg border border-[#1E293B]/60 group-hover:border-[#00D4AA]/20 transition-colors">
                    {channels.length}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 transition-transform duration-300 ${
                      channelsOpen ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </div>
              </button>

              {channelsOpen && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-[fade-in_0.2s_ease-out]">
                  {channels.map((ch) => {
                    const freshness = getFreshnessLevel(ch.last_ingested)
                    const youtubeUrl = ch.youtube_channel_id
                      ? `https://www.youtube.com/channel/${ch.youtube_channel_id}/videos`
                      : `https://www.youtube.com/results?search_query=${encodeURIComponent(ch.channel_name)}&sp=CAI%253D`
                    return (
                      <a
                        key={ch.channel_id}
                        href={youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative flex items-center gap-4 rounded-xl border border-[#1E293B] bg-[#141B2D]/40 px-5 py-4 hover:border-[#2D3A4F] hover:bg-[#141B2D] transition-all duration-200 overflow-hidden"
                      >
                        {/* Freshness accent — left edge bar */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
                          style={{ backgroundColor: freshness.color }}
                          aria-hidden="true"
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-[#F1F5F9] group-hover:text-[#00D4AA] transition-colors truncate">
                              {ch.channel_name}
                            </p>
                            <ExternalLink className="h-3 w-3 text-[#475569] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] text-[#64748B]">
                              {ch.total_videos} video{ch.total_videos !== 1 ? 's' : ''} ingested
                            </span>
                          </div>
                        </div>

                        {/* Freshness indicator */}
                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                          <span
                            className="text-[10px] font-medium font-[family-name:var(--font-geist-mono)]"
                            style={{ color: freshness.color }}
                          >
                            {freshness.label}
                          </span>
                          <span className="text-[10px] text-[#475569]">
                            {ch.last_ingested ? timeAgo(ch.last_ingested) : 'never'}
                          </span>
                        </div>
                      </a>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          {/* ─── Infrastructure (collapsible) ─── */}
          <section className="animate-fade-up stagger-5 space-y-3">
            <button
              onClick={() => setInfraOpen(!infraOpen)}
              className="flex items-center justify-between w-full text-left group py-3 px-4 rounded-xl hover:bg-[#141B2D]/40 border border-transparent hover:border-[#1E293B]/60 transition-all duration-300"
              aria-expanded={infraOpen}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#141B2D]/50 border border-[#1E293B]/60 group-hover:border-[#00D4AA]/30 group-hover:bg-[#00D4AA]/5 transition-all duration-300">
                  <Cloud className="h-4.5 w-4.5 text-[#64748B] group-hover:text-[#00D4AA] transition-colors duration-300" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-[#F1F5F9] group-hover:text-white transition-colors duration-300">
                    Infrastructure & Billing
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[#475569] group-hover:text-[#00D4AA]/70 transition-colors">
                <span className="text-xs font-[family-name:var(--font-geist-mono)] bg-[#141B2D]/80 px-2.5 py-1 rounded-lg border border-[#1E293B]/60 group-hover:border-[#00D4AA]/20 transition-colors">
                  {INFRA_LINKS.reduce((sum, g) => sum + g.links.length, 0)} links
                </span>
                <ChevronDown
                  className={`h-5 w-5 transition-transform duration-300 ${
                    infraOpen ? 'rotate-0' : '-rotate-90'
                  }`}
                />
              </div>
            </button>

            {infraOpen && (
              <div className="mt-2 space-y-6 animate-[fade-in_0.2s_ease-out]">
                {INFRA_LINKS.map((group) => (
                  <div key={group.category}>
                    <h3 className="text-xs font-medium text-[#8B95A8] mb-2.5 px-1">
                      {group.category}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {group.links.map((link) => {
                        const Icon = link.icon
                        return (
                          <a
                            key={link.label}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group/link flex items-center gap-3 rounded-lg border border-[#1E293B] bg-[#141B2D]/30 px-3.5 py-3 hover:border-[#2D3A4F] hover:bg-[#141B2D]/60 transition-all duration-200"
                          >
                            <Icon className="h-4 w-4 shrink-0" style={{ color: link.accent }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[#F1F5F9] group-hover/link:text-white transition-colors truncate">
                                {link.label}
                              </p>
                              <p className="text-[11px] text-[#64748B] truncate">{link.description}</p>
                            </div>
                            <ExternalLink className="h-3 w-3 text-[#475569] opacity-0 group-hover/link:opacity-100 transition-opacity shrink-0" />
                          </a>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* spacer */}
          <div className="pt-6" />
        </div>
      </main>
    </div>
  )
}

// ─── Quote Card Component ───

function QuoteCard() {
  const [quote, setQuote] = useState<{ text: string; author?: string } | null>(null)

  useEffect(() => {
    setQuote(getRandomQuote())
  }, [])

  if (!quote) return null

  return (
    <div className="greeting-stagger-2 mt-5">
      <p className="text-base sm:text-lg text-[#8B95A8] font-light leading-relaxed">
        {quote.text}
        {quote.author && (
          <span className="ml-2 text-[13px] text-[#475569] font-[family-name:var(--font-geist-mono)]">
            — {quote.author}
          </span>
        )}
      </p>
    </div>
  )
}

// ─── Greeting helpers ───

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 6) return 'Night owl'
  if (hour < 12) return 'Morning'
  if (hour < 17) return 'Afternoon'
  if (hour < 21) return 'Evening'
  return 'Late one'
}
