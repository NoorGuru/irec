'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createClient()

      // Supabase handles the code exchange automatically via the URL hash
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        router.replace('/admin/login?error=access_denied')
        return
      }

      // Save the Google provider token to local storage so we can use it to sync the portfolio
      if (session.provider_token) {
        localStorage.setItem('google_provider_token', session.provider_token)
      }
      if (session.provider_refresh_token) {
        localStorage.setItem('google_provider_refresh_token', session.provider_refresh_token)
      }

      // Check if authenticated user is the owner
      const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || ''
      if (session.user.email?.toLowerCase() !== ownerEmail.toLowerCase()) {
        await supabase.auth.signOut()
        router.replace('/admin/login?error=not_owner')
        return
      }

      const nextUrl = localStorage.getItem('auth_next')
      if (nextUrl) {
        localStorage.removeItem('auth_next')
      }
      router.replace(nextUrl || '/admin')
    }

    handleCallback()
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0F1A]">
      <div className="flex flex-col items-center gap-5">
        {/* Animated aura pulse */}
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(0, 212, 170, 0.2) 0%, transparent 70%)',
              animation: 'aura-breathe 2s ease-in-out infinite',
            }}
          />
          <div className="relative w-3 h-3 rounded-full bg-[#00D4AA]/60 animate-pulse" />
        </div>

        <div className="text-center">
          <p className="text-sm text-[#F1F5F9] font-medium">Signing you in</p>
          <p className="mt-1 text-xs text-[#64748B]">Verifying credentials...</p>
        </div>
      </div>
    </div>
  )
}
