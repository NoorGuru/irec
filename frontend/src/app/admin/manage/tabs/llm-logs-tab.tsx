'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, RefreshCw, Trash2, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from 'lucide-react'
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

interface LlmLog {
  id: string
  youtube_video_id: string
  raw_response: string | null
  parse_success: boolean
  error_detail: string | null
  created_at: string
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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Component ───

export function LlmLogsTab() {
  const [logs, setLogs] = useState<LlmLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [purgeOpen, setPurgeOpen] = useState(false)
  const [purging, setPurging] = useState(false)
  const [purgeOlderThan, setPurgeOlderThan] = useState(30)
  const [purgeSuccessOnly, setPurgeSuccessOnly] = useState(true)
  const [showFailuresOnly, setShowFailuresOnly] = useState(false)

  const fetchLogs = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('llm_responses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      console.error('Failed to fetch LLM logs:', error)
      setLoading(false)
      return
    }

    setLogs(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // ─── Filter ───

  const filteredLogs = showFailuresOnly ? logs.filter((l) => !l.parse_success) : logs

  // ─── Retry ───

  const handleRetry = useCallback(async (logId: string) => {
    setRetrying(logId)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${BACKEND_URL}/api/v1/admin/llm-responses/${logId}/retry`, {
        method: 'POST',
        headers,
      })
      if (res.ok) {
        // Refresh logs
        await fetchLogs()
      }
    } catch (e) {
      console.error('Failed to retry:', e)
    } finally {
      setRetrying(null)
    }
  }, [fetchLogs])

  // ─── Purge ───

  const handlePurge = useCallback(async () => {
    setPurging(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${BACKEND_URL}/api/v1/admin/llm-responses/purge`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({
          older_than_days: purgeOlderThan,
          success_only: purgeSuccessOnly,
        }),
      })
      if (res.ok) {
        await fetchLogs()
      }
    } catch (e) {
      console.error('Failed to purge:', e)
    } finally {
      setPurging(false)
      setPurgeOpen(false)
    }
  }, [purgeOlderThan, purgeSuccessOnly, fetchLogs])

  // ─── Stats ───

  const totalLogs = logs.length
  const failureCount = logs.filter((l) => !l.parse_success).length
  const successRate = totalLogs > 0 ? ((totalLogs - failureCount) / totalLogs * 100).toFixed(0) : '—'

  // ─── Loading ───

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-[#141B2D] border border-[#1E293B] rounded-lg p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-[#1E293B] rounded" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-[#1E293B] rounded w-32" />
                <div className="h-3 bg-[#1E293B] rounded w-48" />
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">LLM Logs</h2>
          <p className="text-sm text-[#8B95A8] mt-1">
            {totalLogs} total · {failureCount} failure{failureCount !== 1 ? 's' : ''} · {successRate}% success rate
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFailuresOnly(!showFailuresOnly)}
            className={`border-[#1E293B] text-sm ${showFailuresOnly ? 'text-[#FF4D6A] border-[#FF4D6A]/30' : 'text-[#8B95A8]'}`}
          >
            <AlertCircle className="w-4 h-4 mr-1.5" />
            Failures only
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPurgeOpen(true)}
            className="border-[#1E293B] text-[#8B95A8] hover:text-[#FF4D6A] hover:border-[#FF4D6A]/30"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Purge
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {filteredLogs.map((log) => {
          const isExpanded = expandedId === log.id
          const isRetrying = retrying === log.id

          return (
            <div
              key={log.id}
              className={`bg-[#141B2D] border border-[#1E293B] rounded-lg overflow-hidden transition-colors ${
                !log.parse_success ? 'border-l-2 border-l-[#FF4D6A]' : ''
              }`}
            >
              <div className="p-4 flex items-center gap-3">
                {/* Status icon */}
                {log.parse_success ? (
                  <CheckCircle2 className="w-4 h-4 text-[#00D4AA] flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-[#FF4D6A] flex-shrink-0" />
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-[#F1F5F9]">{log.youtube_video_id}</span>
                    <span className="text-xs text-[#8B95A8]">{formatDate(log.created_at)}</span>
                  </div>
                  {log.error_detail && (
                    <p className="text-xs text-[#FF4D6A] mt-0.5 truncate">{log.error_detail}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!log.parse_success && (
                    <button
                      onClick={() => handleRetry(log.id)}
                      disabled={isRetrying}
                      className="p-1.5 text-[#8B95A8] hover:text-[#00D4AA] hover:bg-[#00D4AA]/10 rounded transition-colors"
                      title="Retry extraction"
                    >
                      {isRetrying ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    className="p-1.5 text-[#8B95A8] hover:text-[#F1F5F9] rounded transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded raw response */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-[#1E293B]">
                  <div className="mt-3">
                    <label className="text-[10px] font-mono text-[#8B95A8] uppercase tracking-wider">Raw Response</label>
                    <pre className="mt-2 p-3 bg-[#0A0F1A] rounded-md text-xs font-mono text-[#8B95A8] overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-all">
                      {log.raw_response || '(no response captured)'}
                    </pre>
                  </div>
                  {log.error_detail && (
                    <div className="mt-3">
                      <label className="text-[10px] font-mono text-[#FF4D6A] uppercase tracking-wider">Error</label>
                      <p className="mt-1 text-xs text-[#FF4D6A]">{log.error_detail}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {filteredLogs.length === 0 && (
          <div className="text-center py-12 text-[#8B95A8]">
            <p className="text-sm">{showFailuresOnly ? 'No failures found' : 'No LLM logs yet'}</p>
          </div>
        )}
      </div>

      {/* Purge Dialog */}
      <Dialog open={purgeOpen} onOpenChange={setPurgeOpen}>
        <DialogContent className="bg-[#141B2D] border-[#1E293B] text-[#F1F5F9]">
          <DialogHeader>
            <DialogTitle className="text-[#FF4D6A]">Purge LLM Logs</DialogTitle>
            <DialogDescription className="text-[#8B95A8]">
              Permanently delete old LLM response logs to free up storage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <label className="text-xs text-[#8B95A8] font-mono mb-1 block">Older than (days)</label>
              <input
                type="number"
                min={1}
                max={365}
                value={purgeOlderThan}
                onChange={(e) => setPurgeOlderThan(parseInt(e.target.value) || 30)}
                className="w-full h-9 px-3 rounded-md bg-[#0A0F1A] border border-[#1E293B] text-sm text-[#F1F5F9] font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="purge-success-only"
                checked={purgeSuccessOnly}
                onChange={(e) => setPurgeSuccessOnly(e.target.checked)}
                className="rounded border-[#1E293B] bg-[#0A0F1A]"
              />
              <label htmlFor="purge-success-only" className="text-sm text-[#8B95A8]">
                Only purge successful logs (keep failures for debugging)
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurgeOpen(false)} className="border-[#1E293B] text-[#8B95A8]">
              Cancel
            </Button>
            <Button
              onClick={handlePurge}
              disabled={purging}
              className="bg-[#FF4D6A] hover:bg-[#FF4D6A]/80 text-white"
            >
              {purging ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Purge Logs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
