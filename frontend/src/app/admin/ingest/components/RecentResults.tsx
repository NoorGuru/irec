import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, History } from 'lucide-react'
import { SectionCollapse } from './SectionCollapse'

interface RecentVideo {
  video_id: string
  title: string
  channels: { channel_name: string } | null
  extracted_at: string
  recommendations: { id: string }[]
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function RecentResults() {
  const [recentVideos, setRecentVideos] = useState<RecentVideo[]>([])

  useEffect(() => {
    async function loadRecent() {
      const supabase = createClient()
      const { data } = await supabase
        .from('videos')
        .select(`
          video_id,
          title,
          extracted_at,
          channels ( channel_name ),
          recommendations ( id )
        `)
        .order('extracted_at', { ascending: false })
        .limit(5)

      if (data) setRecentVideos(data as unknown as RecentVideo[])
    }
    loadRecent()
    
    // Auto-refresh every 30s
    const interval = setInterval(loadRecent, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <SectionCollapse id="recent_results" title="Recent Results" icon={History} defaultExpanded={false}>
      <div className="space-y-3">
        {recentVideos.length === 0 ? (
          <p className="text-sm text-[#8B95A8]">No recent extractions.</p>
        ) : (
          recentVideos.map((v) => (
            <div key={v.video_id} className="flex items-center justify-between gap-4 rounded-xl border border-[#1E293B] bg-[#0A0F1A]/40 p-3 hover:bg-[#1E293B]/20 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <CheckCircle2 className="h-4 w-4 text-[#00D4AA] shrink-0" />
                <div className="min-w-0">
                  <Link href={`/video?id=${v.video_id}`} className="text-sm font-medium text-[#F1F5F9] truncate hover:text-[#00D4AA] transition-colors block">
                    {v.title || 'Unknown Title'}
                  </Link>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-[#8B95A8]">
                    <span className="truncate">{v.channels?.channel_name || 'Unknown Channel'}</span>
                    <span>•</span>
                    <span className="shrink-0">{v.recommendations.length} tickers</span>
                  </div>
                </div>
              </div>
              <span className="shrink-0 text-[10px] text-[#64748B] font-[family-name:var(--font-geist-mono)]">
                {timeAgo(v.extracted_at)}
              </span>
            </div>
          ))
        )}
      </div>
    </SectionCollapse>
  )
}
