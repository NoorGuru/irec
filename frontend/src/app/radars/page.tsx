'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Activity } from 'lucide-react'
import RadarCard from '@/components/ui/radar-card'
import { RadarResponse } from '@/lib/types'

export default function RadarsIndexPage() {
  const [radars, setRadars] = useState<RadarResponse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/v1/radars`)
        const data = res.ok ? await res.json() : []
        setRadars(data)
      } catch (e) {
        console.error("Failed to fetch radars", e)
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0F1A]">
        <Activity className="w-8 h-8 text-[#00D4AA] animate-spin" />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#0A0F1A] text-[#E2E8F0] p-4 md:p-8 font-[family-name:var(--font-geist-sans)] selection:bg-[#00D4AA]/30">
      <div className="max-w-[1400px] w-full mx-auto pt-6 pb-20 px-4">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[#64748B] hover:text-[#00D4AA] transition-colors mb-12 uppercase tracking-widest font-semibold">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          Back to Dashboard
        </Link>

        <header className="mb-12 animate-fade-up">
          <h1 className="text-5xl md:text-7xl font-light tracking-tight text-[#F1F5F9] mb-4">
            Stock <span className="font-medium bg-gradient-to-r from-[#00D4AA] to-[#00FFD0] text-transparent bg-clip-text">Radars</span>
          </h1>
          <p className="text-lg text-[#8B95A8] max-w-2xl leading-relaxed">
            Curated micro-universes of stocks. Track the collective YouTube sentiment of the market&apos;s most important narratives in real-time.
          </p>
        </header>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 animate-fade-up stagger-2">
          {radars.map(radar => (
            <RadarCard key={radar.slug} radar={radar} />
          ))}
        </div>
      </div>
    </main>
  )
}
