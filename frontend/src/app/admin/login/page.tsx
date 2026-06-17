'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

function getTimeGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 6) return 'Late night session?'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  if (hour < 21) return 'Good evening'
  return 'Burning the midnight oil?'
}

function LoginContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const [hovering, setHovering] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleLogin = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth/callback',
      },
    })
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0A0F1A]">
      {/* ─── Warm atmospheric background ─── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {/* Primary warm glow — shifted slightly up for a cozy "lamplight" feel */}
        <div
          className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(0, 212, 170, 0.08) 0%, rgba(196, 255, 242, 0.03) 30%, transparent 65%)',
            animation: 'aura-breathe 8s ease-in-out infinite',
          }}
        />
        {/* Secondary amber warmth — subtle, human */}
        <div
          className="absolute left-[40%] top-[55%] -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-40"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(251, 191, 36, 0.04) 0%, transparent 60%)',
            animation: 'aura-breathe 10s ease-in-out 2s infinite',
          }}
        />
      </div>

      {/* ─── Main content ─── */}
      <div className="relative z-10 w-full max-w-md px-6 animate-hero-rise">
        {/* Personal greeting — the warm anchor */}
        <div className="mb-10 text-center">
          {mounted && (
            <p
              className="text-sm text-[#8B95A8] tracking-wide mb-6 byline-appear"
              style={{ animationDelay: '100ms' }}
            >
              {getTimeGreeting()}
            </p>
          )}
          <h1 className="text-7xl md:text-8xl font-extralight tracking-[0.25em] logo-sweep select-none">
            {'aura'.split('').map((letter, i) => (
              <span
                key={i}
                className="logo-letter animate-letter-reveal"
                style={{ animationDelay: `${i * 120 + 300}ms` }}
              >
                {letter}
              </span>
            ))}
          </h1>
          <p
            className="mt-6 text-[13px] tracking-wide text-[#64748B] font-light byline-appear"
            style={{ animationDelay: '900ms' }}
          >
            Your corner of the market
          </p>
        </div>

        {/* Error messages */}
        {error === 'not_owner' && (
          <div className="mb-6 rounded-xl border border-[#FF4D6A]/15 bg-[#FF4D6A]/[0.03] px-5 py-4 animate-fade-up">
            <p className="text-sm text-[#FF4D6A]/90">
              This space is private. Only the owner can sign in.
            </p>
          </div>
        )}

        {error === 'access_denied' && (
          <div className="mb-6 rounded-xl border border-[#F59E0B]/15 bg-[#F59E0B]/[0.03] px-5 py-4 animate-fade-up">
            <p className="text-sm text-[#F59E0B]/90">
              Sign-in was cancelled. Try again when you&apos;re ready.
            </p>
          </div>
        )}

        {/* Sign-in button — inviting, not intimidating */}
        <button
          onClick={handleLogin}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          className="group relative w-full overflow-hidden rounded-2xl border border-[#1E293B]/80 bg-[#141B2D]/90 px-6 py-5 transition-all duration-500 hover:border-[#00D4AA]/30 hover:bg-[#141B2D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4AA]/50 active:scale-[0.97]"
          style={{ animationDelay: '1100ms' }}
        >
          {/* Warm hover glow */}
          <div
            className={`absolute inset-0 rounded-2xl transition-opacity duration-700 ${hovering ? 'opacity-100' : 'opacity-0'}`}
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(0, 212, 170, 0.05) 0%, rgba(196, 255, 242, 0.02) 50%, transparent 70%)',
            }}
          />

          <div className="relative flex items-center justify-center gap-3.5">
            {/* Google icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" className="shrink-0">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>

            <span className="text-[15px] font-medium text-[#F1F5F9] tracking-wide">
              Sign in with Google
            </span>
          </div>

          {/* Bottom accent line — warmer reveal */}
          <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-[#00D4AA]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        </button>

        {/* Footer — just a quiet breath */}
        <p className="mt-10 text-center text-[11px] text-[#475569]/60 tracking-wide">
          built by noor, for noor
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0A0F1A]">
          <div className="h-1 w-16 rounded-full bg-[#1E293B] overflow-hidden">
            <div className="h-full w-1/2 rounded-full bg-[#00D4AA]/40 animate-shimmer" />
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
