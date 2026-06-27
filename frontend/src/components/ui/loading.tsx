'use client'

import { useEffect, useState } from 'react'

interface LoadingProps {
  title?: string // Page-specific title (e.g., "Radars", "Explore")
  subtitle?: string // Page-specific subtitle (e.g., "Loading analyst profiles...")
  isHome?: boolean // Special case for home page with full logo
}

export default function Loading({ title, subtitle, isHome = false }: LoadingProps) {
  const [ellipsis, setEllipsis] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setEllipsis(prev => prev.length >= 3 ? '' : prev + '.')
    }, 500)
    return () => clearInterval(interval)
  }, [])

  if (isHome) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div
            className="absolute glow-emerge"
            style={{ width: '320px', height: '320px', animationDelay: '600ms' }}
          >
            <div className="aura-glow" />
            <div className="aura-glow-inner" />
          </div>
          <div className="relative text-center">
            <div className="text-8xl md:text-9xl font-extralight tracking-[0.25em] logo-sweep">
              {'aura'.split('').map((letter, i) => (
                <span
                  key={i}
                  className="logo-letter letter-materialize"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  {letter}
                </span>
              ))}
            </div>
            <a
              href="https://bynoor.io"
              target="_blank"
              rel="noopener noreferrer"
              className="byline-appear inline-block mt-4 text-sm font-light text-[#64748B] hover:text-[#00D4AA] transition-colors duration-300 tracking-[0.15em]"
              style={{ animationDelay: '700ms' }}
            >
              by noor
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0F1A]">
      <div className="relative flex items-center justify-center">
        <div
          className="absolute glow-emerge"
          style={{ width: '200px', height: '200px', animationDelay: '300ms' }}
        >
          <div className="aura-glow" />
        </div>
        <div className="relative text-center">
          {title ? (
            <div className="text-5xl font-extralight tracking-[0.2em] logo-sweep">
              {title.split('').map((letter, i) => (
                <span
                  key={i}
                  className="logo-letter letter-materialize"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {letter}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-5xl font-extralight tracking-[0.2em] logo-sweep">
              {'LOADING'.split('').map((letter, i) => (
                <span
                  key={i}
                  className="logo-letter letter-materialize"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {letter}
                </span>
              ))}
            </div>
          )}
          {subtitle ? (
            <p className="mt-3 text-xs text-[#64748B] byline-appear" style={{ animationDelay: `${title ? title.length * 80 + 300 : 600}ms` }}>
              {subtitle}
            </p>
          ) : (
            <p className="mt-3 text-xs text-[#64748B] byline-appear" style={{ animationDelay: '600ms' }}>
              Initializing system...
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
