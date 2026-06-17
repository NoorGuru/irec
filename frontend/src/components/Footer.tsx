'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

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
  const showSplit = backendCommit !== null && frontendCommit !== 'dev' && !backendCommit.startsWith(frontendCommit.slice(0, 7))

  return (
    <footer className="relative mt-auto w-full" role="contentinfo">
      {/* Single teal line — the signature divider */}
      <div className="mx-6 md:mx-12 lg:mx-20">
        <div className="h-px bg-gradient-to-r from-transparent via-[#00D4AA]/40 to-transparent" />
      </div>

      <div className="max-w-6xl mx-auto px-6 md:px-12 lg:px-20 py-10 md:py-14">
        {/* Core: brand + nav in one tight row */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          {/* Left: the wordmark as a link home */}
          <div className="space-y-3">
            <Link href="/" className="group inline-block">
              <span className="font-[family-name:var(--font-geist-mono)] text-2xl md:text-3xl font-light tracking-[0.25em] text-[#F1F5F9]/80 group-hover:text-[#00D4AA] transition-colors duration-300">
                aura
              </span>
            </Link>
            <p className="text-xs text-[#475569] max-w-[280px] leading-relaxed">
              What YouTube analysts are actually picking.
            </p>
          </div>

          {/* Right: links — compact, mono */}
          <nav className="flex items-center gap-6" aria-label="Footer navigation">
            <Link
              href="/"
              className="text-xs font-[family-name:var(--font-geist-mono)] text-[#64748B] hover:text-[#00D4AA] transition-colors duration-200 tracking-wide"
            >
              dashboard
            </Link>
            <Link
              href="/channels"
              className="text-xs font-[family-name:var(--font-geist-mono)] text-[#64748B] hover:text-[#00D4AA] transition-colors duration-200 tracking-wide"
            >
              channels
            </Link>
          </nav>
        </div>

        {/* Bottom strip */}
        <div className="mt-10 pt-6 border-t border-[#1E293B]/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* byline — the signature touch */}
          <a
            href="https://bynoor.io"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5"
          >
            <span className="text-[10px] tracking-[0.2em] uppercase text-[#374151] group-hover:text-[#475569] transition-colors duration-300">
              by
            </span>
            <span className="font-[family-name:var(--font-geist-mono)] text-xs font-medium tracking-[0.1em] text-[#64748B] group-hover:text-[#00D4AA] transition-colors duration-300">
              noor
            </span>
          </a>

          {/* Meta */}
          <div className="flex items-center gap-3 text-[10px] font-[family-name:var(--font-geist-mono)] text-[#374151] tracking-wide">
            <span>not financial advice</span>
            <span aria-hidden="true" className="text-[#1E293B]">·</span>
            <span>© {currentYear}</span>
          </div>
        </div>

        {/* Build hash — whisper-quiet */}
        <div className="mt-4 text-center font-[family-name:var(--font-geist-mono)] text-[9px] text-[#1E293B] tracking-wider">
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
    </footer>
  )
}
