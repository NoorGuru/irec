'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

function WaveformLine() {
  // A continuous waveform that evokes stock charts / audio signals
  return (
    <svg
      viewBox="0 0 800 60"
      fill="none"
      className="w-full h-12 md:h-16 opacity-20"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0 30 C40 30 60 22 100 24 C140 26 160 38 200 35 C240 32 260 16 300 18 C340 20 360 40 400 36 C440 32 460 14 500 18 C540 22 560 38 600 34 C640 30 660 20 700 22 C740 24 760 30 800 30"
        stroke="url(#waveGradient)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="15%" stopColor="#00D4AA" />
          <stop offset="50%" stopColor="#00FFD0" />
          <stop offset="85%" stopColor="#00D4AA" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function FloatingOrb({ size, x, y, delay }: { size: number; x: string; y: string; delay: string }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        left: x,
        top: y,
        background: `radial-gradient(ellipse at center, rgba(0, 212, 170, 0.08) 0%, transparent 70%)`,
        animation: `aura-breathe 6s ease-in-out ${delay} infinite`,
      }}
      aria-hidden="true"
    />
  )
}

export function Footer() {
  const currentYear = new Date().getFullYear()
  const [backendVersion, setBackendVersion] = useState<{ commit: string; build_date: string } | null>(null)

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || ''
    if (!backendUrl) return
    fetch(`${backendUrl}/api/v1/version`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setBackendVersion(data) })
      .catch(() => {})
  }, [])

  const frontendCommit = process.env.NEXT_PUBLIC_COMMIT_HASH || 'dev'
  const frontendBuildDate = process.env.NEXT_PUBLIC_BUILD_DATE || ''
  const backendCommit = backendVersion?.commit && backendVersion.commit !== 'dev' ? backendVersion.commit : null
  // Show split view only when backend was fetched AND commits actually differ
  const showSplit = backendCommit !== null && frontendCommit !== 'dev' && !backendCommit.startsWith(frontendCommit.slice(0, 7))

  return (
    <footer
      className="relative mt-auto w-full overflow-hidden"
      role="contentinfo"
    >
      {/* ─── Atmospheric Background Layer ─── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Gradient wash from dark to slightly lighter for depth */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, transparent 0%, rgba(20, 27, 45, 0.4) 30%, rgba(20, 27, 45, 0.8) 100%)`,
          }}
        />
        {/* Floating orbs for ambient atmosphere */}
        <FloatingOrb size={300} x="10%" y="20%" delay="0s" />
        <FloatingOrb size={200} x="70%" y="40%" delay="2s" />
        <FloatingOrb size={150} x="85%" y="10%" delay="4s" />
      </div>

      <div className="relative z-10 pt-24 pb-12 px-6 md:px-12 lg:px-20">
        {/* ─── Waveform Separator ─── */}
        <WaveformLine />

        {/* ─── Main Content Grid ─── */}
        <div className="max-w-6xl mx-auto mt-16">
          {/* The big wordmark — signature moment */}
          <div className="text-center mb-20">
            <h2 className="text-7xl md:text-8xl lg:text-9xl font-extralight tracking-[0.3em] logo-sweep select-none">
              {'aura'.split('').map((letter, i) => (
                <span
                  key={i}
                  className="logo-letter inline-block"
                >
                  {letter}
                </span>
              ))}
            </h2>
            <p className="mt-6 text-lg md:text-xl font-light text-[#64748B] tracking-wide max-w-md mx-auto leading-relaxed">
              Collective intelligence from the analysts you watch, distilled into signal.
            </p>
          </div>

          {/* ─── Three Column Grid ─── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 lg:gap-16 mb-20">
            {/* Navigate */}
            <div>
              <h3 className="text-[10px] uppercase tracking-[0.25em] text-[#475569] font-medium mb-5">
                Navigate
              </h3>
              <nav className="space-y-3" aria-label="Footer navigation">
                <Link
                  href="/"
                  className="block text-sm text-[#8B95A8] hover:text-[#00D4AA] transition-colors duration-200"
                >
                  Dashboard
                </Link>
                <Link
                  href="/channels"
                  className="block text-sm text-[#8B95A8] hover:text-[#00D4AA] transition-colors duration-200"
                >
                  Channels
                </Link>
              </nav>
            </div>

            {/* About the project */}
            <div>
              <h3 className="text-[10px] uppercase tracking-[0.25em] text-[#475569] font-medium mb-5">
                About
              </h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                AI extracts stock picks from YouTube analysts and aggregates them into trust-weighted consensus signals.
              </p>
            </div>

            {/* Source + Connect */}
            <div>
              <h3 className="text-[10px] uppercase tracking-[0.25em] text-[#475569] font-medium mb-5">
                Open Source
              </h3>
              <div className="space-y-3">
                <a
                  href="https://github.com/NoorGuru/irec"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2 text-sm text-[#8B95A8] hover:text-[#00D4AA] transition-colors duration-200"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  <span>View on GitHub</span>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <path d="M4 12L12 4M12 4H6M12 4V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>
                <a
                  href="https://bynoor.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2 text-sm text-[#8B95A8] hover:text-[#00D4AA] transition-colors duration-200"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                  </svg>
                  <span>bynoor.io</span>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <path d="M4 12L12 4M12 4H6M12 4V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* ─── Bottom Bar ─── */}
          <div className="border-t border-[#1E293B] pt-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Credit */}
              <a
                href="https://bynoor.io"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2"
              >
                <span className="text-[11px] tracking-[0.18em] text-[#374151] group-hover:text-[#475569] transition-colors duration-300">
                  crafted by
                </span>
                <span className="font-[family-name:var(--font-geist-mono)] text-sm font-medium tracking-[0.08em] text-[#475569] group-hover:text-[#00D4AA] transition-colors duration-300">
                  noor
                </span>
              </a>

              {/* Disclaimer + year */}
              <div className="flex items-center gap-3 text-[10px] font-[family-name:var(--font-geist-mono)] text-[#374151] tracking-wide">
                <span>not financial advice</span>
                <span aria-hidden="true" className="text-[#1E293B]">·</span>
                <span>© {currentYear}</span>
              </div>
            </div>

            {/* Build version */}
            <div className="mt-6 text-center font-[family-name:var(--font-geist-mono)] text-[9px] text-[#1E293B] tracking-wider">
              {showSplit ? (
                <span className="inline-flex items-center gap-2 flex-wrap justify-center">
                  <a
                    href={`https://github.com/NoorGuru/irec/commit/${frontendCommit}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[#374151] transition-colors duration-300"
                  >
                    fe:{frontendCommit}
                    {frontendBuildDate && (
                      <> · {new Date(frontendBuildDate).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</>
                    )}
                  </a>
                  <span aria-hidden="true" className="text-[#1E293B]">·</span>
                  <a
                    href={`https://github.com/NoorGuru/irec/commit/${backendCommit}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[#374151] transition-colors duration-300"
                  >
                    be:{backendCommit!.slice(0, 7)}
                    {backendVersion?.build_date && (
                      <> · {new Date(backendVersion.build_date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</>
                    )}
                  </a>
                </span>
              ) : (
                <a
                  href={`https://github.com/NoorGuru/irec/commit/${frontendCommit}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#374151] transition-colors duration-300"
                >
                  {frontendCommit}
                  {frontendBuildDate && (
                    <> · {new Date(frontendBuildDate).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</>
                  )}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
