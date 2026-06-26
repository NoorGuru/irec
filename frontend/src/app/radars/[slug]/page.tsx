import { RADARS, getRadarBySlug } from '@/lib/radars'
import Link from 'next/link'
import { Activity } from 'lucide-react'
import { notFound } from 'next/navigation'
import RadarDetailClient from './client'

export function generateStaticParams() {
  return RADARS.map((radar) => ({
    slug: radar.slug,
  }))
}

export default async function RadarPage(
  props: { params: Promise<{ slug: string }> }
) {
  const params = await props.params;
  const radar = getRadarBySlug(params.slug)

  if (!radar) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-[#0A0F1A] text-[#E2E8F0] font-[family-name:var(--font-geist-sans)] selection:bg-[#00D4AA]/30">
      
      {/* Hero Section with View Transition connection */}
      <section 
        className="relative pt-24 pb-16 px-4 md:px-8 overflow-hidden bg-[#141B2D]/40 border-b border-white/5"
        style={{ viewTransitionName: `radar-${radar.slug}` } as any}
      >
        <div
          className={`absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] ${radar.gradient} pointer-events-none`}
        />
        
        <div className="relative z-10 max-w-6xl mx-auto">
          <Link href="/radars" className="inline-flex items-center gap-2 text-sm text-[#64748B] hover:text-[#00D4AA] transition-colors mb-8 uppercase tracking-widest font-semibold">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            Back to Radars
          </Link>
          
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-[#F1F5F9] animate-pulse" />
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[#8B95A8] font-[family-name:var(--font-geist-mono)]">
              Radar Signal Active
            </h2>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-[#F1F5F9] mb-4">
            {radar.name}
          </h1>
          <p className="text-xl text-[#8B95A8] max-w-3xl leading-relaxed">
            {radar.description}
          </p>
        </div>
      </section>

      {/* Client Component for Data Fetching & Rendering */}
      <section className="px-4 md:px-8 py-12">
        <div className="max-w-6xl mx-auto">
          <RadarDetailClient radar={radar} />
        </div>
      </section>

    </main>
  )
}
