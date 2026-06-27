'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import RadarCard from '@/components/ui/radar-card'
import Loading from '@/components/ui/loading'
import { RadarResponse } from '@/lib/types'

export default function RadarsIndexPage() {
  const [radars, setRadars] = useState<RadarResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/v1/radars`)
        const data = res.ok ? await res.json() : []
        setRadars(data)
      } catch (e) {
        console.error("Failed to fetch radars", e)
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  // Extract unique categories from radars
  const categories = useMemo(() => {
    const uniqueCategories = new Set(['all', ...radars.map(radar => radar.category)])
    return Array.from(uniqueCategories).sort()
  }, [radars])

  // Filter radars by selected category
  const filteredRadars = useMemo(() => {
    if (selectedCategory === 'all') {
      return radars
    }
    return radars.filter(radar => radar.category === selectedCategory)
  }, [radars, selectedCategory])

  if (loading) {
    return <Loading title="Radars" />
  }

  return (
    <main className="min-h-screen bg-[#0A0F1A] text-[#E2E8F0] p-4 md:p-8 font-[family-name:var(--font-geist-sans)] selection:bg-[#00D4AA]/30">
      <div className="max-w-[1400px] w-full mx-auto pt-6 pb-20 px-4">
        <header className="mb-12 animate-fade-up">
          <h1 className="text-5xl md:text-7xl font-light tracking-tight text-[#F1F5F9] mb-4">
            Stock <span className="font-medium bg-gradient-to-r from-[#00D4AA] to-[#00FFD0] text-transparent bg-clip-text">Radars</span>
          </h1>
          <p className="text-lg text-[#8B95A8] max-w-2xl leading-relaxed">
            Curated micro-universes of stocks. Track the collective YouTube sentiment of the market&apos;s most important narratives in real-time.
          </p>
        </header>

        {/* Category Filter */}
        <div className="mb-12 animate-fade-up">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm font-semibold text-[#8B95A8] uppercase tracking-wider">
              Filter by Category
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  selectedCategory === category
                    ? 'bg-[#00D4AA] text-[#0A0F1A] shadow-lg shadow-[#00D4AA]/20'
                    : 'bg-[#1E293B] text-[#8B95A8] hover:bg-[#2D3A4F] hover:text-[#E2E8F0] hover:border-[#00D4AA]/30 border border-transparent'
                }`}
              >
                {category === 'all' ? 'All' : category}
              </button>
            ))}
          </div>
        </div>

        {/* Radars Grid */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 animate-fade-up stagger-2">
          {filteredRadars.map(radar => (
            <RadarCard key={radar.slug} radar={radar} />
          ))}
        </div>

        {/* No Results Message */}
        {filteredRadars.length === 0 && (
          <div className="text-center py-12 animate-fade-up">
            <p className="text-lg text-[#8B95A8]">
              No radars found in the selected category.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
