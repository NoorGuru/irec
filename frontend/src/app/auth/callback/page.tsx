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

      // Check if authenticated user is the owner
      const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || ''
      if (session.user.email?.toLowerCase() !== ownerEmail.toLowerCase()) {
        await supabase.auth.signOut()
        router.replace('/admin/login?error=not_owner')
        return
      }

      router.replace('/admin/ingest')
    }

    handleCallback()
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-zinc-500">Signing you in...</p>
    </div>
  )
}
