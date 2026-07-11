import { AlertTriangle, Play, Trash2 } from 'lucide-react'
import { FailedIngestion, JobConfig } from './types'

export function FailedIngestions({
  failedIngestions,
  onClearAll,
  onRetry,
  onRemove
}: {
  failedIngestions: FailedIngestion[]
  onClearAll: () => void
  onRetry: (url: string) => void
  onRemove: (url: string) => void
}) {
  if (failedIngestions.length === 0) return null

  return (
    <div className="mt-12 animate-fade-up">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[#FF4D6A]" />
          <h3 className="text-sm font-semibold text-[#F1F5F9]">
            Failed Ingestions
          </h3>
          <span className="ml-2 rounded-full bg-[#1E293B] px-2 py-0.5 text-[10px] font-medium text-[#8B95A8]">
            {failedIngestions.length}
          </span>
        </div>
        <button
          onClick={onClearAll}
          className="text-xs text-[#8B95A8] hover:text-[#FF4D6A] transition-colors"
        >
          Clear all
        </button>
      </div>

      <div className="grid gap-3">
        {failedIngestions.map((failed) => (
          <div key={failed.url} className="group relative rounded-xl border border-[#1E293B] bg-[#141B2D]/40 p-4 transition-all hover:border-[#FF4D6A]/30 hover:bg-[#141B2D]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] text-[#64748B] font-[family-name:var(--font-geist-mono)]">
                    {new Date(failed.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm font-medium text-[#F1F5F9] truncate font-[family-name:var(--font-geist-mono)]">
                  {failed.url}
                </p>
                <p className="text-xs text-[#FF4D6A]/80 mt-1 line-clamp-2">
                  {failed.error}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onRetry(failed.url)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#00D4AA]/10 px-3 py-2 text-xs font-semibold text-[#00D4AA] hover:bg-[#00D4AA]/20 transition-colors"
                >
                  <Play className="h-3.5 w-3.5" />
                  Retry
                </button>
                <button
                  onClick={() => onRemove(failed.url)}
                  className="p-2 rounded-lg text-[#8B95A8] hover:text-[#FF4D6A] hover:bg-[#FF4D6A]/10 transition-colors"
                  aria-label="Remove from list"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
