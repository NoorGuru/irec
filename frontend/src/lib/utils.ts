import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Canonical public conviction scale: 0–100. Prefer continuous score; fall back to level × 10. */
export function conviction100(rec: {
  conviction_score?: number | null
  conviction_level?: number | null
}): number {
  if (rec.conviction_score != null) return Number(rec.conviction_score)
  if (rec.conviction_level != null) return Number(rec.conviction_level) * 10
  return 50
}

/** Map legacy API/cache avg_conviction (1–10) to public 0–100 scale. */
export function normalizeAvgConviction100(value: number): number {
  if (value > 0 && value <= 10) return value * 10
  return value
}

export function formatConviction(score: number, digits = 0): string {
  const normalized = normalizeAvgConviction100(score)
  const n = digits > 0 ? normalized.toFixed(digits) : String(Math.round(normalized))
  return `${n}/100`
}

/** Single-line conviction for tables/cards (no duplicate mini + text). */
export function formatConvictionOrDash(score: number | null | undefined): string {
  if (score == null) return '—'
  return formatConviction(score)
}

/**
 * Canonical public aura scale: 0–100.
 * Legacy stock_meta.priority_score is 0–1; today/radar aura_score is already 0–100.
 */
export function normalizeAura100(value: number): number {
  if (value > 0 && value <= 1) return value * 100
  return Math.max(0, Math.min(100, value))
}

export function formatAura(score: number, digits = 0): string {
  const normalized = normalizeAura100(score)
  const n = digits > 0 ? normalized.toFixed(digits) : String(Math.round(normalized))
  return `${n}/100`
}

export function formatAuraOrDash(score: number | null | undefined): string {
  if (score == null) return '—'
  return formatAura(score)
}

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return "Just now"
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays === 1) return "1d ago"
  return `${diffInDays}d ago`
}

export function isMarketOpen(): boolean {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric'
  })
  const parts = formatter.formatToParts(now)
  
  let weekday = ''
  let hour = 0
  let minute = 0
  
  for (const part of parts) {
    if (part.type === 'weekday') weekday = part.value
    if (part.type === 'hour') hour = parseInt(part.value, 10)
    if (part.type === 'minute') minute = parseInt(part.value, 10)
  }
  
  if (weekday === 'Sat' || weekday === 'Sun') return false
  
  const timeInMinutes = hour * 60 + minute
  const marketOpen = 9 * 60 + 30 // 9:30 AM
  const marketClose = 16 * 60 // 4:00 PM
  
  return timeInMinutes >= marketOpen && timeInMinutes < marketClose
}

export function formatMarketTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000)

  if (!isMarketOpen() && diffInMinutes > 15) {
    return "Market Closed"
  }

  return formatRelativeTime(isoString)
}

export function formatLocalTime(isoString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(isoString))
}

export function formatDateTime(isoString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(isoString))
}
