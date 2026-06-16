import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  // Handle OAuth failure/cancellation
  if (error) {
    return NextResponse.redirect(`${origin}/admin/login?error=access_denied`)
  }

  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      return NextResponse.redirect(`${origin}/admin/login?error=access_denied`)
    }

    // Check if authenticated user is the owner
    const { data: { user } } = await supabase.auth.getUser()
    const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || ''

    if (user?.email?.toLowerCase() !== ownerEmail.toLowerCase()) {
      // Sign out non-owner users
      await supabase.auth.signOut()
      return NextResponse.redirect(`${origin}/admin/login?error=not_owner`)
    }

    return NextResponse.redirect(`${origin}/admin/ingest`)
  }

  return NextResponse.redirect(`${origin}/admin/login?error=access_denied`)
}
