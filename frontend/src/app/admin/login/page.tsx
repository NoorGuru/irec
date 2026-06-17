'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

function LoginContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

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
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold text-foreground">
          aura Admin
        </h1>

        {error === 'not_owner' && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            You are not authorized to access this application.
          </div>
        )}

        {error === 'access_denied' && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            Authentication was not completed.
          </div>
        )}

        <Button
          onClick={handleLogin}
          className="w-full"
          size="lg"
        >
          Sign in with Google
        </Button>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
