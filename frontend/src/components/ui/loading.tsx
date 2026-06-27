'use client'

import { useEffect, useState } from 'react'

interface LoadingProps {
  title?: string // Page-specific title (e.g., "Radars", "Explore")
  isHome?: boolean // Special case for home page with full logo
}

export default function Loading({ title, isHome = false }: LoadingProps) {
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
          style={{ width: '320px', height: '320px', animationDelay: '600ms' }}
        >
          <div className="aura-glow" />
          <div className="aura-glow-inner" />
        </div>
        <div className="relative text-center">
          {title ? (
            <div className="text-4xl md:text-5xl font-extralight tracking-[0.25em] text-white mb-4">
              {title}<span className="text-[#00D4AA]">{ellipsis}</span>
            </div>
          ) : (
            <div className="text-4xl md:text-5xl font-extralight tracking-[0.25em] text-white mb-4">
              LOADING<span className="text-[#00D4AA]">{ellipsis}</span>
            </div>
          )}
          <div className="text-sm text-[#64748B] tracking-[0.15em]">
            INITIALIZING SYSTEM...
          </div>
        </div>
      </div>
    </div>
  )
}
