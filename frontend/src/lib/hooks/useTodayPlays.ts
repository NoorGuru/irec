'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { TodayPlaysData, Play } from '@/lib/types'
import { normalizeAvgConviction100 } from '@/lib/utils'

export const TODAY_PLAYS_CACHE_KEY = 'aura_today_plays_v3'
export const TODAY_PLAYS_ETAG_KEY = 'aura_today_plays_etag_v3'

function normalizePlay(play: Play): Play {
  return {
    ...play,
    avg_conviction: normalizeAvgConviction100(play.avg_conviction),
  }
}

function normalizePlaysData(data: TodayPlaysData): TodayPlaysData {
  return {
    ...data,
    plays: (data.plays || []).map(normalizePlay),
  }
}

export function useTodayPlays(days = 30) {
  const [data, setData] = useState<TodayPlaysData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)

  // Fetch from network with ETag validation
  const fetchPlays = useCallback(async () => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        'http://localhost:8000'

      const storedEtag = typeof window !== 'undefined' ? localStorage.getItem(TODAY_PLAYS_ETAG_KEY) : null
      const headers: HeadersInit = {}
      if (storedEtag) {
        headers['If-None-Match'] = storedEtag
      }

      const res = await fetch(`${backendUrl}/api/v1/today?days=${days}`, {
        headers,
      })

      if (res.status === 304) {
        // Cache is still fresh, nothing changed
        if (isMounted.current) {
          setLoading(false)
        }
        return
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch today's plays (${res.status})`)
      }

      const freshEtag = res.headers.get('ETag')
      const json: TodayPlaysData = await res.json()

      if (isMounted.current && json && json.plays) {
        const normalized = normalizePlaysData(json)
        setData(normalized)
        setError(null)
        setLoading(false)

        try {
          localStorage.setItem(TODAY_PLAYS_CACHE_KEY, JSON.stringify(normalized))
          if (freshEtag) {
            localStorage.setItem(TODAY_PLAYS_ETAG_KEY, freshEtag)
          }
        } catch {}
      }
    } catch (err: unknown) {
      if (isMounted.current) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load plays'
        console.warn('Network fetch for today plays encountered an issue:', errorMsg)
        // Only set error if we don't already have cached data
        if (!data) {
          setError(errorMsg)
        }
        setLoading(false)
      }
    }
  }, [days, data])

  useEffect(() => {
    isMounted.current = true

    // Step 1: Immediate hydrate from localStorage
    try {
      const cached = localStorage.getItem(TODAY_PLAYS_CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed?.plays?.length > 0) {
          const normalized = normalizePlaysData(parsed)
          queueMicrotask(() => {
            if (isMounted.current) {
              setData(normalized)
              setLoading(false)
            }
          })
        }
      }
    } catch {}


    // Step 2: Background network revalidation
    fetchPlays()

    return () => {
      isMounted.current = false
    }
  }, [fetchPlays])

  return {
    data,
    plays: data?.plays || [],
    marketMood: data?.market_mood || null,
    generatedAt: data?.generated_at || null,
    loading: loading && (!data || data.plays.length === 0),
    error,
    refresh: fetchPlays,
  }
}
