'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Trash2, Search, Pencil, Check, X, ChevronDown, ChevronUp } from 'lucide-react'
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

interface Recommendation {
  id: string
  ticker: string
  stock_name: string | null
  sentiment: number
  target_price: number | null
  conviction_level: number | null
  catalyst_notes: string | null
  video_title: string | null
  channel_name: string
  extracted_at: string
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

function sentimentLabel(s: number): string {
  switch (s) {
    case -2: return 'Strong Sell'
    case -1: return 'Sell'
    case 0: return 'Neutral'
    case 1: return 'Buy'
    case 2: return 'Strong Buy'
    default: return '—'
  }
}

function sentimentColor(s: number): string {
  if (s >= 2) return '#00D4AA'
  if (s === 1) return '#00D4AA80'
  if (s === 0) return '#8B95A8'
  if (s === -1) return '#FF4D6A80'
  return '#FF4D6A'
}

// ─── Component ───

export function RecommendationsTab() {
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [sentimentFilter, setSentimentFilter] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Recommendation>>({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Recommendation | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchRecs = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('recommendations')
      .select(`
        id,
        ticker,
        stock_name,
        sentiment,
        target_price,
        conviction_level,
        catalyst_notes,
        videos!inner(title, extracted_at, channels!inner(channel_name))
      `)
      .order('id', { ascending: false })
      .limit(5000)

    if (error) {
      console.error('Failed to fetch recommendations:', error)
      setLoading(false)
      return
    }

    const mapped: Recommendation[] = (data || []).map((r: Record<string, unknown>) => {
      const video = r.videos as { title: string | null; extracted_at: string; channels: { channel_name: string } }
      return {
        id: r.id as string,
        ticker: r.ticker as string,
        stock_name: r.stock_name as string | null,
        sentiment: r.sentiment as number,
        target_price: r.target_price as number | null,
        conviction_level: r.conviction_level as number | null,
        catalyst_notes: r.catalyst_notes as string | null,
        video_title: video?.title || null,
        channel_name: video?.channels?.channel_name || 'Unknown',
        extracted_at: video?.extracted_at || '',
      }
    })

    setRecs(mapped)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchRecs()
  }, [fetchRecs])

  // ─── Filter ───

  const filteredRecs = recs.filter((r) => {
    if (channelFilter && r.channel_name !== channelFilter) return false
    if (sentimentFilter !== null && r.sentiment !== sentimentFilter) return false
    
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.ticker.toLowerCase().includes(q) ||
      (r.stock_name?.toLowerCase().includes(q) || false) ||
      r.channel_name.toLowerCase().includes(q) ||
      (r.video_title?.toLowerCase().includes(q) || false)
    )
  })

  // ─── Edit ───

  const startEdit = (rec: Recommendation) => {
    setEditingId(rec.id)
    setExpandedId(rec.id)
    setEditData({
      ticker: rec.ticker,
      sentiment: rec.sentiment,
      target_price: rec.target_price,
      conviction_level: rec.conviction_level,
      catalyst_notes: rec.catalyst_notes,
    })
  }

  const handleSave = useCallback(async () => {
    if (!editingId) return
    setSaving(true)
    try {
      const headers = await getAuthHeaders()
      const body: Record<string, unknown> = {}
      if (editData.ticker) body.ticker = editData.ticker
      if (editData.sentiment !== undefined) body.sentiment = editData.sentiment
      if (editData.target_price !== undefined) body.target_price = editData.target_price
      if (editData.conviction_level !== undefined) body.conviction_level = editData.conviction_level
      if (editData.catalyst_notes !== undefined) body.catalyst_notes = editData.catalyst_notes

      const res = await fetch(`${BACKEND_URL}/api/v1/admin/recommendations/${editingId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const updated = await res.json()
        setRecs((prev) =>
          prev.map((r) => r.id === editingId ? { ...r, ...updated } : r)
        )
      }
    } catch (e) {
      console.error('Failed to save recommendation:', e)
    } finally {
      setSaving(false)
      setEditingId(null)
      setEditData({})
    }
  }, [editingId, editData])

  // ─── Delete ───

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const headers = await getAuthHeaders()
      await fetch(`${BACKEND_URL}/api/v1/admin/recommendations/${deleteTarget.id}`, {
        method: 'DELETE',
        headers,
      })
      setRecs((prev) => prev.filter((r) => r.id !== deleteTarget.id))
    } catch (e) {
      console.error('Failed to delete recommendation:', e)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }, [deleteTarget])

  // ─── Loading ───

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-[#141B2D] border border-[#1E293B] rounded-lg p-5 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="h-8 w-20 bg-[#1E293B] rounded" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-[#1E293B] rounded w-24" />
                <div className="h-2 bg-[#1E293B] rounded w-full max-w-xs" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">Recommendations</h2>
        <p className="text-sm text-[#8B95A8] mt-1">
          {filteredRecs.length} recommendation{filteredRecs.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B95A8]" />
          <Input
            placeholder="Search ticker, company, channel, or video... (Press '/' to focus)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-[#0A0F1A] border-[#1E293B] text-[#F1F5F9] placeholder:text-[#8B95A8]/60 focus-visible:ring-[#00D4AA]/30"
          />
        </div>
        
        <div className="flex flex-wrap gap-4 pt-1 pb-2">
          {/* Sentiment Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            <span className="text-xs text-[#8B95A8] font-mono mr-1">Sentiment:</span>
            <button
              onClick={() => setSentimentFilter(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${sentimentFilter === null ? 'bg-[#1E293B] border-[#8B95A8]/30 text-[#F1F5F9]' : 'bg-[#0A0F1A] border-[#1E293B] text-[#8B95A8] hover:text-[#F1F5F9]'}`}
            >All</button>
            {[2, 1, 0, -1, -2].map(s => (
              <button
                key={s}
                onClick={() => setSentimentFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border`}
                style={{
                  backgroundColor: sentimentFilter === s ? sentimentColor(s) + '20' : '#0A0F1A',
                  borderColor: sentimentFilter === s ? sentimentColor(s) + '50' : '#1E293B',
                  color: sentimentFilter === s ? sentimentColor(s) : '#8B95A8'
                }}
              >
                {sentimentLabel(s)}
              </button>
            ))}
          </div>
          
          {/* Channel Select */}
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="h-7 px-3 rounded-full bg-[#0A0F1A] border border-[#1E293B] text-xs font-medium text-[#8B95A8] focus:text-[#F1F5F9] focus:ring-[#00D4AA]/30 focus:border-[#00D4AA]/50 outline-none transition-colors"
          >
            <option value="">All Channels</option>
            {Array.from(new Set(recs.map(r => r.channel_name))).sort().map(ch => (
              <option key={ch} value={ch}>{ch}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Rec Cards */}
      <div className="space-y-2">
        {filteredRecs.map((rec) => {
          const isEditing = editingId === rec.id
          const isExpanded = expandedId === rec.id

          return (
            <div
              key={rec.id}
              className={`bg-[#141B2D]/40 backdrop-blur-md border rounded-xl overflow-hidden transition-all duration-300 hover:bg-[#141B2D]/60 ${
                isEditing ? 'border-[#00D4AA]/50 shadow-[0_0_15px_rgba(0,212,170,0.1)]' : 'border-[#1E293B]/60 hover:border-[#1E293B]'
              }`}
            >
              {/* Main row */}
              <div className="p-4 flex items-center gap-4">
                {/* Ticker — massive mono */}
                <div className="flex-shrink-0 w-20">
                  {isEditing ? (
                    <Input
                      value={editData.ticker || ''}
                      onChange={(e) => setEditData((d) => ({ ...d, ticker: e.target.value.toUpperCase() }))}
                      className="h-8 text-lg font-mono font-bold bg-[#0A0F1A] border-[#1E293B] text-[#F1F5F9] px-2 uppercase w-full"
                    />
                  ) : (
                    <span className="text-xl font-mono font-bold text-[#F1F5F9] tracking-wide">
                      {rec.ticker}
                    </span>
                  )}
                </div>

                {/* Sentiment pulse bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs text-[#8B95A8]">{rec.stock_name || '—'}</span>
                    <span className="text-[#1E293B]">·</span>
                    <span className="text-xs text-[#8B95A8] font-mono">{rec.channel_name}</span>
                  </div>
                  {/* Pulse bar */}
                  <div className="relative h-2 bg-[#0A0F1A] rounded-full overflow-hidden">
                    <div
                      className="absolute top-0 left-1/2 h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.abs(rec.sentiment) * 25}%`,
                        backgroundColor: sentimentColor(rec.sentiment),
                        transform: rec.sentiment >= 0 ? 'translateX(0)' : 'translateX(-100%)',
                      }}
                    />
                    {/* Center line */}
                    <div className="absolute top-0 left-1/2 w-px h-full bg-[#1E293B]" />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] font-mono text-[#8B95A8]">SELL</span>
                    <span
                      className="text-[10px] font-mono font-medium"
                      style={{ color: sentimentColor(rec.sentiment) }}
                    >
                      {sentimentLabel(rec.sentiment)}
                    </span>
                    <span className="text-[10px] font-mono text-[#8B95A8]">BUY</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="p-1.5 text-[#00D4AA] hover:bg-[#00D4AA]/10 rounded transition-colors"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditData({}) }}
                        className="p-1.5 text-[#8B95A8] hover:text-[#F1F5F9] rounded transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                        className="p-1.5 text-[#8B95A8] hover:text-[#F1F5F9] rounded transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => startEdit(rec)}
                        className="p-1.5 text-[#8B95A8] hover:text-[#F1F5F9] hover:bg-[#1E293B] rounded transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(rec)}
                        className="p-1.5 text-[#8B95A8] hover:text-[#FF4D6A] hover:bg-[#FF4D6A]/10 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Expanded/Edit section */}
              {(isExpanded || isEditing) && (
                <div className="px-4 pb-4 pt-0 border-t border-[#1E293B] mt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3">
                    {/* Sentiment */}
                    <div>
                      <label className="text-[10px] font-mono text-[#8B95A8] uppercase tracking-wider">Sentiment</label>
                      {isEditing ? (
                        <div className="flex gap-1 mt-1">
                          {[-2, -1, 0, 1, 2].map((s) => (
                            <button
                              key={s}
                              onClick={() => setEditData((d) => ({ ...d, sentiment: s }))}
                              className={`w-7 h-7 rounded text-xs font-mono font-bold transition-colors ${
                                editData.sentiment === s
                                  ? 'bg-[#00D4AA] text-[#0A0F1A]'
                                  : 'bg-[#0A0F1A] text-[#8B95A8] hover:text-[#F1F5F9] border border-[#1E293B]'
                              }`}
                            >
                              {s > 0 ? `+${s}` : s}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm font-mono mt-1" style={{ color: sentimentColor(rec.sentiment) }}>
                          {rec.sentiment > 0 ? '+' : ''}{rec.sentiment} ({sentimentLabel(rec.sentiment)})
                        </p>
                      )}
                    </div>

                    {/* Target Price */}
                    <div>
                      <label className="text-[10px] font-mono text-[#8B95A8] uppercase tracking-wider">Target Price</label>
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editData.target_price ?? ''}
                          onChange={(e) => setEditData((d) => ({ ...d, target_price: e.target.value ? parseFloat(e.target.value) : undefined }))}
                          className="h-7 mt-1 text-sm font-mono bg-[#0A0F1A] border-[#1E293B] text-[#F1F5F9]"
                        />
                      ) : (
                        <p className="text-sm font-mono mt-1 text-[#F1F5F9]">
                          {rec.target_price ? `$${rec.target_price.toFixed(2)}` : '—'}
                        </p>
                      )}
                    </div>

                    {/* Conviction */}
                    <div>
                      <label className="text-[10px] font-mono text-[#8B95A8] uppercase tracking-wider">Conviction</label>
                      {isEditing ? (
                        <div className="flex gap-0.5 mt-1">
                          {[...Array(10)].map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setEditData((d) => ({ ...d, conviction_level: i + 1 }))}
                              className={`w-2.5 h-5 rounded-sm transition-colors ${
                                (editData.conviction_level || 0) > i
                                  ? 'bg-[#00D4AA]'
                                  : 'bg-[#1E293B]'
                              }`}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex gap-0.5 mt-1">
                          {[...Array(10)].map((_, i) => (
                            <div
                              key={i}
                              className={`w-2.5 h-5 rounded-sm ${
                                (rec.conviction_level || 0) > i ? 'bg-[#00D4AA]' : 'bg-[#1E293B]'
                              }`}
                            />
                          ))}
                          <span className="text-xs font-mono text-[#8B95A8] ml-1.5">{rec.conviction_level || '—'}/10</span>
                        </div>
                      )}
                    </div>

                    {/* Video */}
                    <div>
                      <label className="text-[10px] font-mono text-[#8B95A8] uppercase tracking-wider">Source</label>
                      <p className="text-xs text-[#8B95A8] mt-1 truncate">{rec.video_title || '—'}</p>
                    </div>
                  </div>

                  {/* Catalyst notes */}
                  {(rec.catalyst_notes || isEditing) && (
                    <div className="mt-3 pt-3 border-t border-[#1E293B]/50">
                      <label className="text-[10px] font-mono text-[#8B95A8] uppercase tracking-wider">Catalyst</label>
                      {isEditing ? (
                        <textarea
                          value={editData.catalyst_notes ?? ''}
                          onChange={(e) => setEditData(d => ({ ...d, catalyst_notes: e.target.value }))}
                          className="w-full mt-1 min-h-[60px] p-2 text-xs font-mono bg-[#0A0F1A] border border-[#1E293B] text-[#F1F5F9] rounded-md focus:border-[#00D4AA]/50 outline-none resize-y"
                          placeholder="Add catalyst notes..."
                        />
                      ) : (
                        <p className="text-xs text-[#8B95A8] mt-1">{rec.catalyst_notes}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {filteredRecs.length === 0 && (
          <div className="text-center py-12 text-[#8B95A8]">
            <p className="text-sm">No recommendations found</p>
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="bg-[#141B2D] border-[#1E293B] text-[#F1F5F9]">
          <DialogHeader>
            <DialogTitle className="text-[#FF4D6A]">Delete Recommendation</DialogTitle>
            <DialogDescription className="text-[#8B95A8]">
              Remove this recommendation permanently.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 flex items-center gap-3">
            <span className="text-xl font-mono font-bold text-[#F1F5F9]">{deleteTarget?.ticker}</span>
            <span className="text-sm text-[#8B95A8]">{deleteTarget?.stock_name}</span>
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
