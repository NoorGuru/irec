'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Trash2, RefreshCw, Search, Filter, CheckSquare, Square } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ─── Types ───

interface Video {
  video_id: string
  title: string | null
  youtube_video_id: string
  channel_name: string
  channel_id: string
  extracted_at: string
  published_at: string | null
  duration: number | null
  rec_count: number
}

interface ChannelOption {
  channel_id: string
  channel_name: string
}

// ─── Helpers ───

async function getAuthHeaders() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  }
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || ''

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

// ─── Component ───

export function VideosTab() {
  const [videos, setVideos] = useState<Video[]>([])
  const [channels, setChannels] = useState<ChannelOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<Video | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [reextracting, setReextracting] = useState(false)
  const [reextractResult, setReextractResult] = useState<{ success: number; failed: number } | null>(null)

  const fetchVideos = useCallback(async () => {
    const supabase = createClient()

    // Fetch channels for filter
    const { data: chData } = await supabase
      .from('channels')
      .select('channel_id, channel_name')
      .order('channel_name')
    setChannels(chData || [])

    // Fetch videos with channel join
    let query = supabase
      .from('videos')
      .select(`
        video_id,
        title,
        youtube_video_id,
        channel_id,
        extracted_at,
        published_at,
        duration,
        channels!inner(channel_name),
        recommendations(count)
      `)
      .order('extracted_at', { ascending: false })
      .limit(200)

    if (channelFilter) {
      query = query.eq('channel_id', channelFilter)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to fetch videos:', error)
      setLoading(false)
      return
    }

    const mapped: Video[] = (data || []).map((v: Record<string, unknown>) => ({
      video_id: v.video_id as string,
      title: v.title as string | null,
      youtube_video_id: v.youtube_video_id as string,
      channel_name: (v.channels as { channel_name: string })?.channel_name || 'Unknown',
      channel_id: v.channel_id as string,
      extracted_at: v.extracted_at as string,
      published_at: v.published_at as string | null,
      duration: v.duration as number | null,
      rec_count: (v.recommendations as Array<{ count: number }>)?.[0]?.count || 0,
    }))

    setVideos(mapped)
    setLoading(false)
  }, [channelFilter])

  useEffect(() => {
    fetchVideos()
  }, [fetchVideos])

  // ─── Filter ───

  const filteredVideos = videos.filter((v) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      v.title?.toLowerCase().includes(q) ||
      v.youtube_video_id.toLowerCase().includes(q) ||
      v.channel_name.toLowerCase().includes(q)
    )
  })

  // ─── Selection ───

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filteredVideos.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredVideos.map((v) => v.video_id)))
    }
  }

  // ─── Delete ───

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const headers = await getAuthHeaders()
      await fetch(`${BACKEND_URL}/api/v1/admin/videos/${deleteTarget.video_id}`, {
        method: 'DELETE',
        headers,
      })
      setVideos((prev) => prev.filter((v) => v.video_id !== deleteTarget.video_id))
      setSelected((prev) => { const next = new Set(prev); next.delete(deleteTarget.video_id); return next })
    } catch (e) {
      console.error('Failed to delete video:', e)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }, [deleteTarget])

  // ─── Bulk Re-extract ───

  const handleBulkReextract = useCallback(async () => {
    if (selected.size === 0) return
    setReextracting(true)
    setReextractResult(null)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${BACKEND_URL}/api/v1/admin/videos/bulk-reextract`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ video_ids: Array.from(selected) }),
      })
      if (res.ok) {
        const data = await res.json()
        setReextractResult({ success: data.success, failed: data.failed })
        // Refresh after re-extract
        await fetchVideos()
        setSelected(new Set())
      }
    } catch (e) {
      console.error('Failed to bulk re-extract:', e)
    } finally {
      setReextracting(false)
    }
  }, [selected, fetchVideos])

  // ─── Loading ───

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-[#141B2D] border border-[#1E293B] rounded-lg p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-[#1E293B] rounded" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-[#1E293B] rounded w-64" />
                <div className="h-3 bg-[#1E293B] rounded w-32" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Videos</h2>
          <p className="text-sm text-[#8B95A8] mt-1">
            {filteredVideos.length} video{filteredVideos.length !== 1 ? 's' : ''}
            {selected.size > 0 && (
              <span className="text-[#00D4AA] ml-2">· {selected.size} selected</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button
              size="sm"
              onClick={handleBulkReextract}
              disabled={reextracting}
              className="bg-[#00D4AA] hover:bg-[#00D4AA]/80 text-[#0A0F1A] font-medium"
            >
              {reextracting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Re-extract ({selected.size})
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B95A8]" />
          <Input
            placeholder="Search videos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[#0A0F1A] border-[#1E293B] text-[#F1F5F9] placeholder:text-[#8B95A8]/60"
          />
        </div>
        <select
          value={channelFilter}
          onChange={(e) => { setChannelFilter(e.target.value); setLoading(true) }}
          className="h-9 px-3 rounded-md bg-[#0A0F1A] border border-[#1E293B] text-sm text-[#F1F5F9]"
        >
          <option value="">All channels</option>
          {channels.map((ch) => (
            <option key={ch.channel_id} value={ch.channel_id}>{ch.channel_name}</option>
          ))}
        </select>
      </div>

      {/* Re-extract Result */}
      {reextractResult && (
        <div className="bg-[#141B2D] border border-[#00D4AA]/30 rounded-lg p-3 flex items-center gap-3">
          <RefreshCw className="w-4 h-4 text-[#00D4AA]" />
          <span className="text-sm">
            Re-extraction complete: <span className="font-mono text-[#00D4AA]">{reextractResult.success}</span> success
            {reextractResult.failed > 0 && (
              <>, <span className="font-mono text-[#FF4D6A]">{reextractResult.failed}</span> failed</>
            )}
          </span>
          <button onClick={() => setReextractResult(null)} className="ml-auto text-[#8B95A8] hover:text-[#F1F5F9]">✕</button>
        </div>
      )}

      {/* Video List */}
      <div className="space-y-2">
        {/* Select All */}
        <button
          onClick={toggleAll}
          className="flex items-center gap-2 text-xs text-[#8B95A8] hover:text-[#F1F5F9] px-1 py-1"
        >
          {selected.size === filteredVideos.length && filteredVideos.length > 0 ? (
            <CheckSquare className="w-4 h-4 text-[#00D4AA]" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          Select all
        </button>

        {filteredVideos.map((video) => (
          <div
            key={video.video_id}
            className={`bg-[#141B2D] border rounded-lg p-4 transition-colors ${
              selected.has(video.video_id)
                ? 'border-[#00D4AA]/50 bg-[#00D4AA]/5'
                : 'border-[#1E293B] hover:border-[#1E293B]/80'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Checkbox */}
              <button
                onClick={() => toggleSelect(video.video_id)}
                className="mt-0.5 flex-shrink-0"
              >
                {selected.has(video.video_id) ? (
                  <CheckSquare className="w-4 h-4 text-[#00D4AA]" />
                ) : (
                  <Square className="w-4 h-4 text-[#8B95A8] hover:text-[#F1F5F9]" />
                )}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-[#F1F5F9] truncate">
                  {video.title || video.youtube_video_id}
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-[#8B95A8] font-mono">
                  <span className="px-1.5 py-0.5 bg-[#0A0F1A] rounded text-[#00D4AA]">
                    {video.channel_name}
                  </span>
                  <span>{video.rec_count} rec{video.rec_count !== 1 ? 's' : ''}</span>
                  <span>{formatDuration(video.duration)}</span>
                  <span>{formatDate(video.extracted_at)}</span>
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={() => setDeleteTarget(video)}
                className="p-1.5 text-[#8B95A8] hover:text-[#FF4D6A] hover:bg-[#FF4D6A]/10 rounded transition-colors flex-shrink-0"
                title="Delete video"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {filteredVideos.length === 0 && (
          <div className="text-center py-12 text-[#8B95A8]">
            <p className="text-sm">No videos found</p>
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="bg-[#141B2D] border-[#1E293B] text-[#F1F5F9]">
          <DialogHeader>
            <DialogTitle className="text-[#FF4D6A]">Delete Video</DialogTitle>
            <DialogDescription className="text-[#8B95A8]">
              This will permanently delete the video and all its recommendations.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <p className="text-sm font-medium truncate">{deleteTarget?.title || deleteTarget?.youtube_video_id}</p>
            <p className="text-xs text-[#8B95A8] mt-1 font-mono">{deleteTarget?.rec_count} recommendation{deleteTarget?.rec_count !== 1 ? 's' : ''} will be deleted</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="border-[#1E293B] text-[#8B95A8]">
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-[#FF4D6A] hover:bg-[#FF4D6A]/80 text-white"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
