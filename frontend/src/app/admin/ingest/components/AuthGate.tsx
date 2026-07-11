'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lock } from 'lucide-react'

export function AuthGate({ 
  children, 
  isDemo,
  onAuthChange
}: { 
  children: React.ReactNode
  isDemo: boolean
  onAuthChange?: (isAuthenticated: boolean, email: string | null) => void
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(isDemo)
  const [isChecking, setIsChecking] = useState(!isDemo)
  const [isFadingOut, setIsFadingOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isDemo) {
      setIsChecking(false)
      onAuthChange?.(true, null)
      return
    }

    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        setIsAuthenticated(false)
        setIsChecking(false)
        onAuthChange?.(false, null)
        return
      }

      const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || ''
      if (session.user.email?.toLowerCase() !== ownerEmail.toLowerCase()) {
        await supabase.auth.signOut()
        setIsAuthenticated(false)
        setError("You don't have permission to access this page. Owner only.")
        setIsChecking(false)
        onAuthChange?.(false, null)
        return
      }

      setIsAuthenticated(true)
      setIsChecking(false)
      onAuthChange?.(true, session.user.email ?? null)
    }

    checkAuth()
    
    // Listen for auth changes (e.g. login from popup)
    const supabase = createClient()
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || ''
        if (session?.user.email?.toLowerCase() === ownerEmail.toLowerCase()) {
          setIsFadingOut(true)
          setTimeout(() => {
            setIsAuthenticated(true)
            setIsFadingOut(false)
            onAuthChange?.(true, session.user.email ?? null)
          }, 400) // matches animate-auth-dissolve
        } else {
          await supabase.auth.signOut()
          setError("You don't have permission to access this page. Owner only.")
        }
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false)
        onAuthChange?.(false, null)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [isDemo, onAuthChange])

  const handleSignIn = async () => {
    const supabase = createClient()
    // By using redirect_to same page, or signInWithOAuth popups, we can stay inline.
    // However, Supabase standard provider typically redirects.
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/admin/ingest`
      }
    })
  }

  // If authenticated and not fading out, just render children
  if (isAuthenticated && !isFadingOut) {
    return <>{children}</>
  }

  return (
    <div className="relative">
      {/* Background content is always rendered so it's visible under the blur */}
      {children}
      
      {/* The frosted overlay */}
      <div 
        className={`absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-[#0A0F1A]/80 backdrop-blur-xl ${
          isFadingOut ? 'animate-auth-dissolve' : ''
        }`}
      >
        <div className="flex flex-col items-center gap-6 p-8 text-center animate-fade-up">
          <div className="rounded-full bg-[#1E293B] p-4 shadow-xl shadow-[#0A0F1A]/50">
            <Lock className="h-8 w-8 text-[#00D4AA]" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-[#F1F5F9]">
              Sign in to command
            </h2>
            <p className="text-sm text-[#8B95A8] max-w-xs">
              Only the owner can trigger extractions and manage the queue.
            </p>
          </div>
          
          {error && (
            <p className="text-xs text-[#FF4D6A] bg-[#FF4D6A]/10 px-3 py-1.5 rounded-md">
              {error}
            </p>
          )}

          <button
            onClick={handleSignIn}
            disabled={isChecking}
            className="flex items-center gap-3 rounded-xl bg-[#F1F5F9] px-6 py-3 text-sm font-bold text-[#0A0F1A] transition-all hover:bg-white hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
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
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  )
}
