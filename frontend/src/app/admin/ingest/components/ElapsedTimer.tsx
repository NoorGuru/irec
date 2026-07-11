import { useEffect, useRef } from 'react'
import { formatElapsed } from './utils'

export function ElapsedTimer({ startedAt, completedAt }: { startedAt: number; completedAt?: number }) {
  const spanRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (completedAt) {
      if (spanRef.current) {
        spanRef.current.textContent = formatElapsed(completedAt - startedAt)
      }
      return
    }
    // Initial render
    if (spanRef.current) {
      spanRef.current.textContent = formatElapsed(Date.now() - startedAt)
    }
    const interval = setInterval(() => {
      if (spanRef.current) {
        spanRef.current.textContent = formatElapsed(Date.now() - startedAt)
      }
    }, 100)
    return () => clearInterval(interval)
  }, [startedAt, completedAt])

  const initialElapsed = completedAt ? completedAt - startedAt : 0

  return (
    <span
      ref={spanRef}
      className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[#8B95A8]/60 tabular-nums"
    >
      {formatElapsed(initialElapsed)}
    </span>
  )
}
