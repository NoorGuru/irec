'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Pencil, Trash2, Merge, Check, X } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// ─── Types ───

interface Channel {
  channel_id: string
  channel_name: string
  trust_weight: number
  youtube_channel_id: string | null
  channel_thumbnail_url: string | null
  created_at: string
  video_count: number
  rec_count: number
}

interface DeleteInfo {
  channel: Channel
  videoCount: number
  recCount: number
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

// ─── Component ───

export function ChannelsTab() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteInfo, setDeleteInfo] = useState<DeleteInfo | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeSource, setMergeSource] = useState<string>('')
  const [mergeTarget, setMergeTarget] = useState<string>('')
  const [merging, setMerging] = useState(false)
  const [savingWeight, setSavingWeight] = useState<string | null>(null)

  const fetchChannels = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('channels')
      .select(`
        channel_id,
        channel_name,
        trust_weight,
        youtube_channel_id,
        channel_thumbnail_url,
        created_at,
        videos(count)
      `)
      .order('channel_name')

    if (error) {
      console.error('Failed to fetch channels:', error)
      setLoading(false)
      return
    }

    // Fetch rec counts per channel
    const { data: recData } = await supabase
      .from('recommendations')
      .select('id, videos!inner(channel_id)')

    const recCountMap: Record<string, number> = {}
    if (recData) {
      for (const rec of recData as any[]) {
        const videos = rec.videos
        const chId = Array.isArray(videos) ? videos[0]?.channel_id : videos?.channel_id
        if (chId) {
          recCountMap[chId] = (recCountMap[chId] || 0) + 1
        }
      }
    }

    const mapped: Channel[] = (data || []).map((ch: Record<string, unknown>) => ({
      channel_id: ch.channel_id as string,
      channel_name: ch.channel_name as string,
      trust_weight: ch.trust_weight as number,
      youtube_channel_id: ch.youtube_channel_id as string | null,
      channel_thumbnail_url: ch.channel_thumbnail_url as string | null,
      created_at: ch.created_at as string,
      video_count: (ch.videos as Array<{ count: number }>)?.[0]?.count || 0,
      rec_count: recCountMap[ch.channel_id as string] || 0,
    }))

    setChannels(mapped)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchChannels()
  }, [fetchChannels])

  // ─── Trust Weight Update ───

  const handleWeightChange = useCallback(async (channelId: string, newWeight: number) => {
    setSavingWeight(channelId)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${BACKEND_URL}/api/v1/admin/channels/${channelId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ trust_weight: newWeight }),
      })
      if (res.ok) {
        setChannels((prev) =>
          prev.map((ch) => ch.channel_id === channelId ? { ...ch, trust_weight: newWeight } : ch)
        )
      }
    } catch (e) {
      console.error('Failed to update trust weight:', e)
    } finally {
      setSavingWeight(null)
    }
  }, [])

  // ─── Rename ───

  const handleRename = useCallback(async (channelId: string) => {
    if (!editName.trim()) return
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${BACKEND_URL}/api/v1/admin/channels/${channelId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ channel_name: editName.trim() }),
      })
      if (res.ok) {
        setChannels((prev) =>
          prev.map((ch) => ch.channel_id === channelId ? { ...ch, channel_name: editName.trim() } : ch)
        )
      }
    } catch (e) {
      console.error('Failed to rename channel:', e)
    } finally {
      setEditingId(null)
      setEditName('')
    }
  }, [editName])

  // ─── Delete ───

  const handleDelete = useCallback(async () => {
    if (!deleteInfo) return
    setDeleting(true)
    try {
      const headers = await getAuthHeaders()
      await fetch(`${BACKEND_URL}/api/v1/admin/channels/${deleteInfo.channel.channel_id}`, {
        method: 'DELETE',
        headers,
      })
      setChannels((prev) => prev.filter((ch) => ch.channel_id !== deleteInfo.channel.channel_id))
    } catch (e) {
      console.error('Failed to delete channel:', e)
    } finally {
      setDeleting(false)
      setDeleteInfo(null)
    }
  }, [deleteInfo])

  // ─── Merge ───

  const handleMerge = useCallback(async () => {
    if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) return
    setMerging(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${BACKEND_URL}/api/v1/admin/channels/merge`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ source_id: mergeSource, target_id: mergeTarget }),
      })
      if (res.ok) {
        await fetchChannels()
      }
    } catch (e) {
      console.error('Failed to merge channels:', e)
    } finally {
      setMerging(false)
      setMergeOpen(false)
      setMergeSource('')
      setMergeTarget('')
    }
  }, [mergeSource, mergeTarget, fetchChannels])

  // ─── Loading ───

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[#141B2D] border border-[#1E293B] rounded-lg p-5 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-[#1E293B] rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-[#1E293B] rounded w-32" />
                <div className="h-3 bg-[#1E293B] rounded w-48" />
              </div>
              <div className="h-2 bg-[#1E293B] rounded w-24" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Channels</h2>
          <p className="text-sm text-[#8B95A8] mt-1">
            {channels.length} channel{channels.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMergeOpen(true)}
          className="border-[#1E293B] text-[#8B95A8] hover:text-[#F1F5F9] hover:border-[#00D4AA]/50"
        >
          <Merge className="w-4 h-4 mr-2" />
          Merge
        </Button>
      </div>

      {/* Channel Cards */}
      {channels.map((ch) => (
        <div
          key={ch.channel_id}
          className="group relative bg-[#141B2D]/40 backdrop-blur-md border border-[#1E293B]/60 rounded-xl p-5 hover:border-[#00D4AA]/30 hover:bg-[#141B2D]/60 transition-all duration-300 overflow-hidden"
        >
          {/* Ambient glow */}
          <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
               style={{ background: 'radial-gradient(circle, rgba(0,212,170,0.05) 0%, transparent 70%)' }} />
          <div className="relative flex items-start gap-4">
            {/* Thumbnail */}
            <div className="w-10 h-10 rounded-full bg-[#1E293B] flex-shrink-0 flex items-center justify-center overflow-hidden">
              {ch.channel_thumbnail_url ? (
                <img
                  src={ch.channel_thumbnail_url}
                  alt={ch.channel_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-mono text-[#8B95A8]">
                  {ch.channel_name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {editingId === ch.channel_id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-7 text-sm bg-[#0A0F1A] border-[#1E293B] w-48"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(ch.channel_id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                    />
                    <button onClick={() => handleRename(ch.channel_id)} className="text-[#00D4AA] hover:text-[#00D4AA]/80">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-[#8B95A8] hover:text-[#F1F5F9]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <h3 className="font-medium text-[#F1F5F9] truncate">{ch.channel_name}</h3>
                    <button
                      onClick={() => { setEditingId(ch.channel_id); setEditName(ch.channel_name) }}
                      className="text-[#8B95A8] hover:text-[#F1F5F9] opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-[#8B95A8] font-mono">
                <span>{ch.video_count} video{ch.video_count !== 1 ? 's' : ''}</span>
                <span className="text-[#1E293B]">·</span>
                <span>{ch.rec_count} rec{ch.rec_count !== 1 ? 's' : ''}</span>
                {ch.youtube_channel_id && (
                  <>
                    <span className="text-[#1E293B]">·</span>
                    <a href={`https://youtube.com/channel/${ch.youtube_channel_id}`} target="_blank" rel="noreferrer" className="hover:text-[#00D4AA] transition-colors">
                      YouTube ↗
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEditingId(ch.channel_id); setEditName(ch.channel_name) }}
                className="p-1.5 text-[#8B95A8] hover:text-[#F1F5F9] hover:bg-[#1E293B] rounded transition-colors"
                title="Rename"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setDeleteInfo({ channel: ch, videoCount: ch.video_count, recCount: ch.rec_count })}
                className="p-1.5 text-[#8B95A8] hover:text-[#FF4D6A] hover:bg-[#FF4D6A]/10 rounded transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="relative mt-5 pt-4 border-t border-[#1E293B]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-[#8B95A8] font-mono uppercase tracking-wider">Trust Score</span>
              <div className="flex gap-1.5">
                {[0.5, 1.0, 1.5, 2.0].map(weight => (
                  <button
                    key={weight}
                    onClick={() => handleWeightChange(ch.channel_id, weight)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors border ${
                      ch.trust_weight === weight
                        ? 'bg-[#00D4AA]/10 border-[#00D4AA]/30 text-[#00D4AA] shadow-[0_0_10px_rgba(0,212,170,0.1)]'
                        : 'bg-[#0A0F1A] border-[#1E293B] text-[#8B95A8] hover:text-[#F1F5F9] hover:border-[#1E293B]/80'
                    }`}
                  >
                    {weight.toFixed(1)}×
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative w-24 h-1.5 bg-[#0A0F1A] rounded-full overflow-hidden hidden sm:block">
                <div
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#00D4AA]/40 to-[#00D4AA] rounded-full transition-all duration-300"
                  style={{ width: `${Math.min((ch.trust_weight / 2.5) * 100, 100)}%` }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={ch.trust_weight}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) handleWeightChange(ch.channel_id, val);
                  }}
                  className={`w-16 h-7 px-1 text-xs font-mono bg-[#0A0F1A] border-[#1E293B] text-center transition-colors ${savingWeight === ch.channel_id ? 'text-[#00D4AA] border-[#00D4AA]/50 shadow-[0_0_10px_rgba(0,212,170,0.1)]' : 'text-[#F1F5F9] focus:border-[#00D4AA]/50'}`}
                />
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteInfo} onOpenChange={() => setDeleteInfo(null)}>
        <DialogContent className="bg-[#141B2D] border-[#1E293B] text-[#F1F5F9]">
          <DialogHeader>
            <DialogTitle className="text-[#FF4D6A]">Delete Channel</DialogTitle>
            <DialogDescription className="text-[#8B95A8]">
              This will permanently delete <strong className="text-[#F1F5F9]">{deleteInfo?.channel.channel_name}</strong> and cascade to:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#8B95A8]">Videos</span>
              <span className="font-mono text-[#FF4D6A]">{deleteInfo?.videoCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#8B95A8]">Recommendations</span>
              <span className="font-mono text-[#FF4D6A]">{deleteInfo?.recCount}</span>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteInfo(null)}
              className="border-[#1E293B] text-[#8B95A8]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-[#FF4D6A] hover:bg-[#FF4D6A]/80 text-white"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent className="bg-[#141B2D] border-[#1E293B] text-[#F1F5F9]">
          <DialogHeader>
            <DialogTitle>Merge Channels</DialogTitle>
            <DialogDescription className="text-[#8B95A8]">
              Move all videos from the source channel to the target, then delete the source.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <label className="text-xs text-[#8B95A8] font-mono mb-1 block">Source (will be deleted)</label>
              <select
                value={mergeSource}
                onChange={(e) => setMergeSource(e.target.value)}
                className="w-full h-9 px-3 rounded-md bg-[#0A0F1A] border border-[#1E293B] text-sm text-[#F1F5F9]"
              >
                <option value="">Select channel...</option>
                {channels.map((ch) => (
                  <option key={ch.channel_id} value={ch.channel_id}>
                    {ch.channel_name} ({ch.video_count} videos)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#8B95A8] font-mono mb-1 block">Target (will receive videos)</label>
              <select
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
                className="w-full h-9 px-3 rounded-md bg-[#0A0F1A] border border-[#1E293B] text-sm text-[#F1F5F9]"
              >
                <option value="">Select channel...</option>
                {channels.filter((ch) => ch.channel_id !== mergeSource).map((ch) => (
                  <option key={ch.channel_id} value={ch.channel_id}>
                    {ch.channel_name} ({ch.video_count} videos)
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMergeOpen(false)}
              className="border-[#1E293B] text-[#8B95A8]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleMerge}
              disabled={merging || !mergeSource || !mergeTarget}
              className="bg-[#00D4AA] hover:bg-[#00D4AA]/80 text-[#0A0F1A] font-medium"
            >
              {merging ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Merge className="w-4 h-4 mr-2" />}
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
