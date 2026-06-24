'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, TrendingUp, Tv2, MessageSquareText, Brain, AlertCircle, RefreshCw } from 'lucide-react'

// ─── Types ───

interface Stats {
  totalVideos: number
  totalRecs: number
  successRate: number
  thisWeek: number
  weeklyTrend: number[] // last 8 weeks
  topChannels: { name: string; count: number; trust: number }[]
  recentFailures: { video_id: string; error: string; date: string }[]
}

// ─── Component ───

export function StatsTab() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
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

  const fetchStats = useCallback(async () => {
    const supabase = createClient()

    try {
      // Total videos
      const { count: videoCount } = await supabase
        .from('videos')
        .select('*', { count: 'exact', head: true })

      // Total recs
      const { count: recCount } = await supabase
        .from('recommendations')
        .select('*', { count: 'exact', head: true })

      // LLM success rate
      const { count: totalLlm } = await supabase
        .from('llm_responses')
        .select('*', { count: 'exact', head: true })

      const { count: failedLlm } = await supabase
        .from('llm_responses')
        .select('*', { count: 'exact', head: true })
        .eq('parse_success', false)

      const successRate = totalLlm ? ((totalLlm - (failedLlm || 0)) / totalLlm * 100) : 100

      // This week's ingestions
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const { count: thisWeek } = await supabase
        .from('videos')
        .select('*', { count: 'exact', head: true })
        .gte('extracted_at', weekAgo.toISOString())

      // Weekly trend (last 8 weeks)
      const weeklyTrend: number[] = []
      for (let i = 7; i >= 0; i--) {
        const start = new Date()
        start.setDate(start.getDate() - (i + 1) * 7)
        const end = new Date()
        end.setDate(end.getDate() - i * 7)
        const { count } = await supabase
          .from('videos')
          .select('*', { count: 'exact', head: true })
          .gte('extracted_at', start.toISOString())
          .lt('extracted_at', end.toISOString())
        weeklyTrend.push(count || 0)
      }

      // Top channels by video count
      const { data: channelData } = await supabase
        .from('channels')
        .select('channel_name, trust_weight, videos(count)')
        .order('channel_name')

      const topChannels = (channelData || [])
        .map((ch: Record<string, unknown>) => ({
          name: ch.channel_name as string,
          count: (ch.videos as Array<{ count: number }>)?.[0]?.count || 0,
          trust: ch.trust_weight as number,
        }))
        .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
        .slice(0, 5)

      // Recent failures
      const { data: failureData } = await supabase
        .from('llm_responses')
        .select('youtube_video_id, error_detail, created_at')
        .eq('parse_success', false)
        .order('created_at', { ascending: false })
        .limit(5)

      const recentFailures = (failureData || []).map((f: Record<string, unknown>) => ({
        video_id: f.youtube_video_id as string,
        error: (f.error_detail as string) || 'Unknown error',
        date: f.created_at as string,
      }))

      setStats({
        totalVideos: videoCount || 0,
        totalRecs: recCount || 0,
        successRate,
        thisWeek: thisWeek || 0,
        weeklyTrend,
        topChannels,
        recentFailures,
      })
    } catch (e) {
      console.error('Failed to fetch stats:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // ─── Loading ───

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#141B2D] border border-[#1E293B] rounded-lg p-5 animate-pulse">
              <div className="h-3 bg-[#1E293B] rounded w-16 mb-3" />
              <div className="h-8 bg-[#1E293B] rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-[#8B95A8]">
        <p>Failed to load stats</p>
      </div>
    )
  }

  const maxWeekly = Math.max(...stats.weeklyTrend, 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">System Health</h2>
          <p className="text-sm text-[#8B95A8] mt-1">Ingestion pipeline performance at a glance</p>
        </div>
        <button
          onClick={handleClearCache}
          disabled={clearingCache}
          className="flex items-center gap-2 bg-[#141B2D] hover:bg-[#1E293B] border border-[#1E293B] text-[#F1F5F9] px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {clearingCache ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 text-[#00D4AA]" />}
          Force Recalculate Cache
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Videos"
          value={stats.totalVideos}
          icon={Tv2}
          color="#00D4AA"
        />
        <StatCard
          label="Total Recs"
          value={stats.totalRecs}
          icon={MessageSquareText}
          color="#00D4AA"
        />
        <StatCard
          label="Success Rate"
          value={`${stats.successRate.toFixed(0)}%`}
          icon={Brain}
          color={stats.successRate >= 90 ? '#00D4AA' : stats.successRate >= 70 ? '#F59E0B' : '#FF4D6A'}
        />
        <StatCard
          label="This Week"
          value={stats.thisWeek}
          icon={TrendingUp}
          color="#00D4AA"
        />
      </div>

      {/* Weekly Bar Chart */}
      <div className="bg-[#141B2D] border border-[#1E293B] rounded-lg p-5">
        <h3 className="text-sm font-medium text-[#8B95A8] mb-4">Weekly Ingestion Volume</h3>
        <div className="flex items-end gap-2 h-32">
          {stats.weeklyTrend.map((count, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-mono text-[#8B95A8]">{count}</span>
              <div
                className="w-full rounded-t transition-all duration-500"
                style={{
                  height: `${(count / maxWeekly) * 100}%`,
                  minHeight: count > 0 ? '4px' : '2px',
                  backgroundColor: i === stats.weeklyTrend.length - 1 ? '#00D4AA' : '#00D4AA60',
                }}
              />
              <span className="text-[9px] font-mono text-[#8B95A8]">
                {i === stats.weeklyTrend.length - 1 ? 'now' : `-${stats.weeklyTrend.length - 1 - i}w`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Channel Leaderboard */}
        <div className="bg-[#141B2D] border border-[#1E293B] rounded-lg p-5">
          <h3 className="text-sm font-medium text-[#8B95A8] mb-4">Top Channels</h3>
          <div className="space-y-3">
            {stats.topChannels.map((ch, i) => (
              <div key={ch.name} className="flex items-center gap-3">
                <span className="text-xs font-mono text-[#8B95A8] w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#F1F5F9] truncate">{ch.name}</span>
                    <span className="text-xs font-mono text-[#8B95A8] ml-2">{ch.count}</span>
                  </div>
                  <div className="mt-1 h-1.5 bg-[#0A0F1A] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00D4AA] rounded-full"
                      style={{ width: `${(ch.count / (stats.topChannels[0]?.count || 1)) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-[10px] font-mono text-[#8B95A8] w-8 text-right">
                  ×{ch.trust.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Failures */}
        <div className="bg-[#141B2D] border border-[#1E293B] rounded-lg p-5">
          <h3 className="text-sm font-medium text-[#8B95A8] mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#FF4D6A]" />
            Recent Failures
          </h3>
          <div className="space-y-3">
            {stats.recentFailures.length === 0 ? (
              <p className="text-xs text-[#8B95A8]">No recent failures</p>
            ) : (
              stats.recentFailures.map((f, i) => (
                <div key={i} className="border-l-2 border-l-[#FF4D6A] pl-3">
                  <p className="text-xs font-mono text-[#F1F5F9]">{f.video_id}</p>
                  <p className="text-xs text-[#FF4D6A] truncate mt-0.5">{f.error}</p>
                  <p className="text-[10px] text-[#8B95A8] mt-0.5">{formatDate(f.date)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───

function StatCard({ label, value, icon: Icon, color }: {
  label: string
  value: number | string
  icon: typeof Tv2
  color: string
}) {
  return (
    <div className="bg-[#141B2D] border border-[#1E293B] rounded-lg p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-xs font-mono text-[#8B95A8] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-3xl font-mono font-bold" style={{ color }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  )
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
