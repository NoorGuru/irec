import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { 
  Play, Trash2, RotateCcw, Sparkles, Clock, CheckSquare, 
  Square, Calendar, ChevronDown, ChevronUp, AlertCircle, 
  HelpCircle, CheckCircle2, History, ListRestart
} from 'lucide-react'
import { SectionCollapse } from './SectionCollapse'

interface QueueVideo {
  id: string
  youtube_video_id: string
  video_url: string
  channel_id: string
  channel_name: string
  title: string
  published_at: string
  thumbnail_url: string
  duration: string
  status: 'discovered' | 'pending_captions' | 'fetching_captions' | 'ready_for_ai' | 'processing_ai' | 'completed' | 'caption_failed' | 'ai_failed' | 'dismissed' | 'snoozed'
  caption_attempts: number
  caption_error?: string
  ai_error?: string
  discovered_at: string
  updated_at: string
}

interface SchedulerLog {
  id: string
  run_type: 'channel_check' | 'caption_fetch'
  schedule_bucket?: string
  channels_checked: number
  new_videos_found: number
  captions_attempted: number
  captions_succeeded: number
  captions_failed: number
  errors: any[]
  started_at: string
  completed_at?: string
  duration_ms?: number
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function AutopilotSection({ isDemo }: { isDemo: boolean }) {
  const [stats, setStats] = useState<any>({
    discovered: 0,
    pending_captions: 0,
    fetching_captions: 0,
    ready_for_ai: 0,
    processing_ai: 0,
    completed: 0,
    caption_failed: 0,
    ai_failed: 0,
    dismissed: 0,
    snoozed: 0
  })

  const [videos, setVideos] = useState<QueueVideo[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'ready' | 'failed_captions' | 'dismissed'>('ready')
  const [filterChannel, setFilterChannel] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'published_newest' | 'published_oldest' | 'discovered_newest'>('published_newest')
  const [schedulerLogs, setSchedulerLogs] = useState<SchedulerLog[]>([])
  
  // Manual paste state inside queue cards
  const [pasteVideoId, setPasteVideoId] = useState<string | null>(null)
  const [manualText, setManualText] = useState('')
  const [processingState, setProcessingState] = useState<Record<string, { loading: boolean; error?: string; result?: string[] }>>({})

  // Load stats and scheduler logs
  const loadStatsAndLogs = useCallback(async () => {
    if (isDemo) {
      setStats({
        discovered: 2,
        pending_captions: 1,
        fetching_captions: 0,
        ready_for_ai: 5,
        processing_ai: 0,
        completed: 12,
        caption_failed: 1,
        ai_failed: 0,
        dismissed: 3,
        snoozed: 0
      })
      setSchedulerLogs([
        {
          id: 'demo-log-1',
          run_type: 'caption_fetch',
          channels_checked: 0,
          new_videos_found: 0,
          captions_attempted: 3,
          captions_succeeded: 2,
          captions_failed: 1,
          errors: [{ video_id: 'err-id', error: 'No captions found' }],
          started_at: new Date(Date.now() - 3600000).toISOString(),
          completed_at: new Date(Date.now() - 3590000).toISOString(),
          duration_ms: 10000
        },
        {
          id: 'demo-log-2',
          run_type: 'channel_check',
          schedule_bucket: 'A',
          channels_checked: 15,
          new_videos_found: 3,
          captions_attempted: 0,
          captions_succeeded: 0,
          captions_failed: 0,
          errors: [],
          started_at: new Date(Date.now() - 14400000).toISOString(),
          completed_at: new Date(Date.now() - 14380000).toISOString(),
          duration_ms: 20000
        }
      ])
      return
    }

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL
      const statsResp = await fetch(`${backendUrl}/api/v1/queue/stats`)
      if (statsResp.ok) {
        const statsData = await statsResp.json()
        setStats(statsData)
      }

      const logsResp = await fetch(`${backendUrl}/api/v1/scheduler/logs?limit=5`)
      if (logsResp.ok) {
        const logsData = await logsResp.json()
        setSchedulerLogs(logsData)
      }
    } catch (e) {
      console.error('Error fetching queue stats/logs:', e)
    }
  }, [isDemo])

  // Load videos based on active tab
  const loadVideos = useCallback(async () => {
    if (isDemo) {
      const demoVideos: QueueVideo[] = [
        {
          id: 'demo-v-1',
          youtube_video_id: 'vid-1',
          video_url: 'https://youtube.com/watch?v=vid-1',
          channel_id: 'chan-1',
          channel_name: 'TechStocks Pro',
          title: 'NVIDIA Q3 Earnings & Blackwell Moat Deep Dive',
          published_at: new Date(Date.now() - 7200000).toISOString(),
          thumbnail_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80',
          duration: 'PT14M35S',
          status: 'ready_for_ai',
          caption_attempts: 1,
          discovered_at: new Date(Date.now() - 7000000).toISOString(),
          updated_at: new Date(Date.now() - 7000000).toISOString()
        },
        {
          id: 'demo-v-2',
          youtube_video_id: 'vid-2',
          video_url: 'https://youtube.com/watch?v=vid-2',
          channel_id: 'chan-2',
          channel_name: 'Financial Daily',
          title: '5 Undervalued Stocks I am Buying in Large Quantities Now',
          published_at: new Date(Date.now() - 86400000).toISOString(),
          thumbnail_url: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=300&q=80',
          duration: 'PT22M18S',
          status: 'ready_for_ai',
          caption_attempts: 1,
          discovered_at: new Date(Date.now() - 80000000).toISOString(),
          updated_at: new Date(Date.now() - 80000000).toISOString()
        },
        {
          id: 'demo-v-3',
          youtube_video_id: 'vid-3',
          video_url: 'https://youtube.com/watch?v=vid-3',
          channel_id: 'chan-1',
          channel_name: 'TechStocks Pro',
          title: 'Crypto Regulation Changes under the New Admin',
          published_at: new Date(Date.now() - 172800000).toISOString(),
          thumbnail_url: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?auto=format&fit=crop&w=300&q=80',
          duration: 'PT18M02S',
          status: 'caption_failed',
          caption_attempts: 5,
          caption_error: 'Transcript is disabled for this video',
          discovered_at: new Date(Date.now() - 150000000).toISOString(),
          updated_at: new Date(Date.now() - 150000000).toISOString()
        },
        {
          id: 'demo-v-4',
          youtube_video_id: 'vid-4',
          video_url: 'https://youtube.com/watch?v=vid-4',
          channel_id: 'chan-3',
          channel_name: 'Macro Alpha',
          title: 'Interest Rate Cuts & Inflation: A Hard Landing Ahead?',
          published_at: new Date(Date.now() - 259200000).toISOString(),
          thumbnail_url: '',
          duration: 'PT31M10S',
          status: 'dismissed',
          caption_attempts: 1,
          discovered_at: new Date(Date.now() - 240000000).toISOString(),
          updated_at: new Date(Date.now() - 240000000).toISOString()
        }
      ]

      if (activeTab === 'ready') {
        setVideos(demoVideos.filter(v => v.status === 'ready_for_ai'))
      } else if (activeTab === 'failed_captions') {
        setVideos(demoVideos.filter(v => v.status === 'caption_failed'))
      } else {
        setVideos(demoVideos.filter(v => v.status === 'dismissed'))
      }
      return
    }

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL
      const statusMap = {
        ready: 'ready_for_ai',
        failed_captions: 'caption_failed',
        dismissed: 'dismissed'
      }
      const resp = await fetch(`${backendUrl}/api/v1/queue/videos?status=${statusMap[activeTab]}&limit=50`)
      if (resp.ok) {
        const data = await resp.json()
        setVideos(data)
      }
    } catch (e) {
      console.error('Error fetching queue videos:', e)
    }
  }, [activeTab, isDemo])

  useEffect(() => {
    loadStatsAndLogs()
    loadVideos()
    
    // Auto-refresh stats/logs/videos every 30s
    const timer = setInterval(() => {
      loadStatsAndLogs()
      loadVideos()
    }, 30000)

    return () => clearInterval(timer)
  }, [loadStatsAndLogs, loadVideos])

  // Get active session
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    if (isDemo) return { 'Content-Type': 'application/json' }
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Unauthenticated')
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    }
  }

  // Batch trigger AI process
  const handleBatchProcess = async () => {
    if (selectedIds.length === 0) return
    
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL
    const newStates = { ...processingState }
    selectedIds.forEach(id => {
      newStates[id] = { loading: true }
    })
    setProcessingState(newStates)

    if (isDemo) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      const updatedStates = { ...processingState }
      selectedIds.forEach(id => {
        updatedStates[id] = { 
          loading: false, 
          result: ['AAPL', 'NVDA'] 
        }
      })
      setProcessingState(updatedStates)
      setSelectedIds([])
      loadStatsAndLogs()
      loadVideos()
      return
    }

    try {
      const headers = await getAuthHeaders()
      const resp = await fetch(`${backendUrl}/api/v1/queue/process`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ video_ids: selectedIds })
      })
      
      if (resp.ok) {
        const data = await resp.json()
        const updatedStates = { ...processingState }
        data.results.forEach((res: any) => {
          if (res.status === 'success') {
            updatedStates[res.id] = { loading: false, result: ['SUCCESS'] }
          } else {
            updatedStates[res.id] = { loading: false, error: res.error }
          }
        })
        setProcessingState(updatedStates)
        setSelectedIds([])
        loadStatsAndLogs()
        loadVideos()
      } else {
        alert('Failed to trigger process')
      }
    } catch (e: any) {
      alert(`Error triggering process: ${e.message}`)
    }
  }

  // Dismiss batch
  const handleBatchDismiss = async (ids: string[], action: 'dismiss' | 'restore') => {
    if (ids.length === 0) return
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL

    if (isDemo) {
      loadStatsAndLogs()
      loadVideos()
      setSelectedIds([])
      return
    }

    try {
      const headers = await getAuthHeaders()
      const resp = await fetch(`${backendUrl}/api/v1/queue/dismiss`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ video_ids: ids, action })
      })
      if (resp.ok) {
        loadStatsAndLogs()
        loadVideos()
        setSelectedIds([])
      }
    } catch (e: any) {
      alert(`Action failed: ${e.message}`)
    }
  }

  // Caption retry
  const handleCaptionRetry = async (ids: string[]) => {
    if (ids.length === 0) return
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL

    if (isDemo) {
      loadStatsAndLogs()
      loadVideos()
      return
    }

    try {
      const headers = await getAuthHeaders()
      const resp = await fetch(`${backendUrl}/api/v1/queue/retry-captions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ video_ids: ids })
      })
      if (resp.ok) {
        loadStatsAndLogs()
        loadVideos()
      }
    } catch (e: any) {
      alert(`Retry failed: ${e.message}`)
    }
  }

  // Submit manual transcript paste
  const handleManualPasteSubmit = async (videoId: string, targetUrl: string) => {
    if (manualText.trim().length < 20) return
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL

    if (isDemo) {
      setPasteVideoId(null)
      setManualText('')
      loadStatsAndLogs()
      loadVideos()
      return
    }

    try {
      // Manual paste transitions to ready_for_ai
      const headers = await getAuthHeaders()
      
      // Update entry with transcript text directly
      const supabase = createClient()
      const { error } = await supabase
        .from('video_queue')
        .update({
          status: 'ready_for_ai',
          transcript: manualText,
          caption_error: null,
          updated_at: new Date(Date.now()).toISOString()
        })
        .eq('id', videoId)

      if (!error) {
        setPasteVideoId(null)
        setManualText('')
        loadStatsAndLogs()
        loadVideos()
      } else {
        alert(`Failed to save transcript: ${error.message}`)
      }
    } catch (e: any) {
      alert(`Failed to submit: ${e.message}`)
    }
  }

  // Sorting & Filtering
  const channels = Array.from(new Set(videos.map(v => v.channel_name)))
  
  const filteredVideos = videos
    .filter(v => filterChannel === 'all' || v.channel_name === filterChannel)
    .sort((a, b) => {
      if (sortBy === 'published_newest') {
        return new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
      } else if (sortBy === 'published_oldest') {
        return new Date(a.published_at).getTime() - new Date(b.published_at).getTime()
      } else {
        return new Date(b.discovered_at).getTime() - new Date(a.discovered_at).getTime()
      }
    })

  const handleSelectAll = () => {
    if (selectedIds.length === filteredVideos.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredVideos.map(v => v.id))
    }
  }

  const handleSelectRow = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  return (
    <SectionCollapse id="autopilot_section" title="Autopilot Queue" icon={Clock} defaultExpanded={true}>
      
      {/* Overview Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-[#1E293B] bg-[#0A0F1A]/60 p-4">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#8B95A8] mb-1">Discovered</div>
          <div className="text-2xl font-[family-name:var(--font-geist-mono)] text-[#F1F5F9]">
            {stats.discovered + stats.pending_captions + stats.fetching_captions}
          </div>
        </div>
        <div className="rounded-xl border border-[#00D4AA]/20 bg-[#00D4AA]/5 p-4">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#00D4AA] mb-1">Ready for AI</div>
          <div className="text-2xl font-[family-name:var(--font-geist-mono)] text-[#00D4AA]">
            {stats.ready_for_ai}
          </div>
        </div>
        <div className="rounded-xl border border-[#FF4D6A]/20 bg-[#FF4D6A]/5 p-4">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#FF4D6A] mb-1">Failed Captions</div>
          <div className="text-2xl font-[family-name:var(--font-geist-mono)] text-[#FF4D6A]">
            {stats.caption_failed}
          </div>
        </div>
        <div className="rounded-xl border border-[#1E293B] bg-[#0A0F1A]/60 p-4">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#8B95A8] mb-1">Completed (Logs)</div>
          <div className="text-2xl font-[family-name:var(--font-geist-mono)] text-[#8B95A8]">
            {stats.completed}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1E293B] mb-6">
        <button
          onClick={() => { setActiveTab('ready'); setSelectedIds([]) }}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${activeTab === 'ready' ? 'border-[#00D4AA] text-[#00D4AA]' : 'border-transparent text-[#8B95A8] hover:text-[#F1F5F9]'}`}
        >
          Ready for AI ({stats.ready_for_ai})
        </button>
        <button
          onClick={() => { setActiveTab('failed_captions'); setSelectedIds([]) }}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${activeTab === 'failed_captions' ? 'border-[#00D4AA] text-[#00D4AA]' : 'border-transparent text-[#8B95A8] hover:text-[#F1F5F9]'}`}
        >
          Failed Captions ({stats.caption_failed})
        </button>
        <button
          onClick={() => { setActiveTab('dismissed'); setSelectedIds([]) }}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${activeTab === 'dismissed' ? 'border-[#00D4AA] text-[#00D4AA]' : 'border-transparent text-[#8B95A8] hover:text-[#F1F5F9]'}`}
        >
          Dismissed ({stats.dismissed})
        </button>
      </div>

      {/* Filter and sorting row */}
      {filteredVideos.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            {activeTab === 'ready' && (
              <>
                <button
                  onClick={handleBatchProcess}
                  disabled={selectedIds.length === 0}
                  className="flex items-center gap-1.5 rounded-lg bg-[#00D4AA] px-3 py-1.5 text-xs font-semibold text-[#0A0F1A] hover:bg-[#00FFD0] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  <Play className="h-3.5 w-3.5" />
                  Process {selectedIds.length} Selected
                </button>
                <button
                  onClick={() => handleBatchDismiss(selectedIds, 'dismiss')}
                  disabled={selectedIds.length === 0}
                  className="flex items-center gap-1.5 rounded-lg bg-[#141B2D] border border-[#1E293B] px-3 py-1.5 text-xs font-semibold text-[#8B95A8] hover:text-[#FF4D6A] hover:border-[#FF4D6A]/30 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Dismiss
                </button>
              </>
            )}
            {activeTab === 'failed_captions' && (
              <>
                <button
                  onClick={() => handleCaptionRetry(selectedIds)}
                  disabled={selectedIds.length === 0}
                  className="flex items-center gap-1.5 rounded-lg bg-[#00D4AA]/10 px-3 py-1.5 text-xs font-semibold text-[#00D4AA] hover:bg-[#00D4AA]/20 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  <ListRestart className="h-3.5 w-3.5" />
                  Retry {selectedIds.length} Selected
                </button>
                <button
                  onClick={() => handleBatchDismiss(selectedIds, 'dismiss')}
                  disabled={selectedIds.length === 0}
                  className="flex items-center gap-1.5 rounded-lg bg-[#141B2D] border border-[#1E293B] px-3 py-1.5 text-xs font-semibold text-[#8B95A8] hover:text-[#FF4D6A] hover:border-[#FF4D6A]/30 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Dismiss
                </button>
              </>
            )}
            {activeTab === 'dismissed' && (
              <button
                onClick={() => handleBatchDismiss(selectedIds, 'restore')}
                disabled={selectedIds.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-[#00D4AA]/10 px-3 py-1.5 text-xs font-semibold text-[#00D4AA] hover:bg-[#00D4AA]/20 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore {selectedIds.length} Selected
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="rounded-lg border border-[#1E293B] bg-[#141B2D] px-2.5 py-1.5 text-xs text-[#F1F5F9] focus:outline-none"
            >
              <option value="all">All Channels</option>
              {channels.map(ch => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-lg border border-[#1E293B] bg-[#141B2D] px-2.5 py-1.5 text-xs text-[#F1F5F9] focus:outline-none"
            >
              <option value="published_newest">Newest Uploads</option>
              <option value="published_oldest">Oldest Uploads</option>
              <option value="discovered_newest">Recently Discovered</option>
            </select>
          </div>
        </div>
      )}

      {/* Video list */}
      <div className="space-y-3">
        {filteredVideos.length === 0 ? (
          <p className="text-sm text-[#8B95A8] py-8 text-center">No videos matching this state.</p>
        ) : (
          <>
            <div className="flex items-center justify-between px-3 text-[10px] uppercase font-bold tracking-wider text-[#64748B] border-b border-[#1E293B]/40 pb-2">
              <button onClick={handleSelectAll} className="flex items-center gap-2 hover:text-[#F1F5F9] transition-colors">
                {selectedIds.length === filteredVideos.length ? <CheckSquare className="h-3.5 w-3.5 text-[#00D4AA]" /> : <Square className="h-3.5 w-3.5" />}
                Select All ({selectedIds.length}/{filteredVideos.length})
              </button>
            </div>
            
            {filteredVideos.map(video => {
              const state = processingState[video.id]
              const isSelected = selectedIds.includes(video.id)

              return (
                <div key={video.id} className={`group relative rounded-xl border border-[#1E293B] bg-[#0A0F1A]/40 p-4 transition-all hover:border-[#00D4AA]/20 ${isSelected ? 'border-[#00D4AA]/40 bg-[#00D4AA]/[0.01]' : ''}`}>
                  <div className="flex items-start gap-4">
                    <button onClick={() => handleSelectRow(video.id)} className="mt-1 shrink-0 text-[#8B95A8] hover:text-[#00D4AA] transition-colors">
                      {isSelected ? <CheckSquare className="h-4 w-4 text-[#00D4AA]" /> : <Square className="h-4 w-4" />}
                    </button>

                    {video.thumbnail_url ? (
                      <img src={video.thumbnail_url} alt="" className="w-24 h-16 object-cover rounded bg-[#1E293B] shrink-0" />
                    ) : (
                      <div className="w-24 h-16 bg-[#141B2D] border border-[#1E293B] rounded flex items-center justify-center shrink-0">
                        <HelpCircle className="h-6 w-6 text-[#8B95A8]/20" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <a href={video.video_url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#F1F5F9] hover:text-[#00D4AA] transition-colors line-clamp-1 block">
                        {video.title || 'Untitled Video'}
                      </a>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-[#8B95A8]">
                        <span className="font-semibold text-[#00D4AA]/80">{video.channel_name}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(video.published_at).toLocaleDateString()}
                        </span>
                        <span>•</span>
                        <span>Discovered {timeAgo(video.discovered_at)}</span>
                      </div>

                      {/* Displaying AI error if any */}
                      {video.ai_error && video.status === 'ai_failed' && (
                        <p className="text-[11px] text-[#FF4D6A] mt-2 font-[family-name:var(--font-geist-mono)] bg-[#FF4D6A]/5 px-2 py-1 rounded">
                          AI error: {video.ai_error}
                        </p>
                      )}

                      {/* Displaying Caption error if any */}
                      {video.caption_error && video.status === 'caption_failed' && (
                        <p className="text-[11px] text-[#FF4D6A] mt-2 font-[family-name:var(--font-geist-mono)] bg-[#FF4D6A]/5 px-2 py-1 rounded">
                          Caption failure: {video.caption_error}
                        </p>
                      )}

                      {/* AI processing result indicator */}
                      {state && (
                        <div className="mt-3 bg-[#0A0F1A] border border-[#1E293B] rounded-lg p-2 flex items-center justify-between">
                          {state.loading && (
                            <div className="flex items-center gap-2 text-xs text-[#F59E0B]">
                              <Clock className="h-3.5 w-3.5 animate-spin" />
                              Running AI extraction...
                            </div>
                          )}
                          {state.error && (
                            <div className="flex items-center gap-2 text-xs text-[#FF4D6A]">
                              <AlertCircle className="h-3.5 w-3.5" />
                              Error: {state.error}
                            </div>
                          )}
                          {state.result && (
                            <div className="flex items-center gap-2 text-xs text-[#00D4AA]">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Saved! Added ticker(s)
                            </div>
                          )}
                        </div>
                      )}

                      {/* Manual Paste Inline Form */}
                      {pasteVideoId === video.id && (
                        <div className="mt-4 animate-inline-expand space-y-3 bg-[#0A0F1A] p-4 rounded-xl border border-[#00D4AA]/20">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold text-[#F1F5F9]">Paste Transcript Manually</h4>
                            <button onClick={() => setPasteVideoId(null)} className="text-xs text-[#8B95A8] hover:text-[#F1F5F9]">Cancel</button>
                          </div>
                          <textarea
                            value={manualText}
                            onChange={(e) => setManualText(e.target.value)}
                            placeholder="Paste raw transcript text or JSON..."
                            rows={3}
                            className="w-full rounded-lg border border-[#1E293B] bg-[#141B2D] px-3 py-2 font-[family-name:var(--font-geist-mono)] text-[11px] text-[#F1F5F9] focus:outline-none focus:border-[#00D4AA]/50"
                          />
                          <button
                            onClick={() => handleManualPasteSubmit(video.id, video.video_url)}
                            disabled={manualText.trim().length < 20}
                            className="w-full rounded-lg bg-[#00D4AA] px-4 py-2 text-xs font-semibold text-[#0A0F1A] hover:bg-[#00FFD0] disabled:opacity-40"
                          >
                            Save & Mark Ready
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Single card action items */}
                    <div className="flex items-center gap-2 self-start shrink-0">
                      {activeTab === 'failed_captions' && pasteVideoId !== video.id && (
                        <button
                          onClick={() => { setPasteVideoId(video.id); setManualText('') }}
                          className="flex items-center gap-1.5 rounded-lg bg-[#00D4AA]/10 px-2.5 py-1.5 text-xs font-semibold text-[#00D4AA] hover:bg-[#00D4AA]/20"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Paste
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleBatchDismiss([video.id], activeTab === 'dismissed' ? 'restore' : 'dismiss')}
                        className="p-1.5 text-[#8B95A8] hover:text-[#FF4D6A] hover:bg-[#FF4D6A]/10 rounded-lg transition-colors"
                        title={activeTab === 'dismissed' ? 'Restore' : 'Dismiss'}
                      >
                        {activeTab === 'dismissed' ? <RotateCcw className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Scheduler logs & buckets (Health info) */}
      <div className="mt-8 pt-6 border-t border-[#1E293B]/60 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#64748B]">Scheduler Logs</h4>
        <div className="grid gap-3">
          {schedulerLogs.map(log => (
            <div key={log.id} className="flex items-start justify-between gap-4 rounded-xl border border-[#1E293B] bg-[#0A0F1A]/20 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${log.run_type === 'channel_check' ? 'text-[#00D4AA]' : 'text-[#F59E0B]'}`}>
                    {log.run_type === 'channel_check' ? `Bucket ${log.schedule_bucket} Check` : 'Caption Fetch'}
                  </span>
                  <span className="text-xs text-[#8B95A8]">•</span>
                  <span className="text-[10px] text-[#64748B] font-[family-name:var(--font-geist-mono)]">
                    {new Date(log.started_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-[#8B95A8] mt-1.5">
                  {log.run_type === 'channel_check' ? (
                    `Checked ${log.channels_checked} channels — discovered ${log.new_videos_found} new upload(s)`
                  ) : (
                    `Attempted ${log.captions_attempted} caption fetches — ${log.captions_succeeded} success / ${log.captions_failed} failed`
                  )}
                </p>
                {log.errors && log.errors.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {log.errors.map((err, i) => (
                      <p key={i} className="text-[10px] text-[#FF4D6A] font-[family-name:var(--font-geist-mono)]">
                        • {err.channel || err.video_id}: {err.error}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              {log.duration_ms && (
                <span className="shrink-0 text-[10px] text-[#64748B] font-[family-name:var(--font-geist-mono)] bg-[#141B2D] px-2 py-0.5 rounded">
                  {log.duration_ms}ms
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

    </SectionCollapse>
  )
}
