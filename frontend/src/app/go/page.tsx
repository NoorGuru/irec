'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  LogOut,
  Database,
  Home,
  PlusCircle,
  GitFork,
  LayoutDashboard,
  Briefcase,
  LogIn
} from 'lucide-react'

export default function GoPage() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setLoading(false)
      if (!session) {
        router.replace('/admin/login?next=/go')
      }
    }
    checkAuth()
  }, [router])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/admin/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0F1A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#00D4AA]"></div>
      </div>
    )
  }

  if (!session) {
    return null // Router will redirect
  }

  const links = [
    { name: 'Home / Dashboard', href: '/', icon: Home, desc: 'Main user-facing app' },
    { name: 'Portfolio', href: '/portfolio', icon: Briefcase, desc: 'View and sync your holdings' },
    { name: 'Fix Token (Re-Login)', href: '/admin/login?next=/portfolio', icon: LogIn, desc: 'Refresh Google Sheets access' },
    { name: 'Admin Hub', href: '/admin', icon: LayoutDashboard, desc: 'Central admin overview' },
    { name: 'Manage Data', href: '/admin/manage', icon: Database, desc: 'Channels, Videos, Stocks' },
    { name: 'Ingest Tool', href: '/admin/ingest', icon: PlusCircle, desc: 'Add new content' },
    { name: 'GitHub Repo', href: 'https://github.com/NoorGuru/irec', icon: GitFork, desc: 'Source code', external: true },
    { name: 'Supabase', href: 'https://supabase.com/dashboard/project/deasjnsdrhnsxqssfbrn', icon: Database, desc: 'Database backend', external: true },
  ]

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-[#F1F5F9] p-6 md:p-12 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-2xl mx-auto space-y-8 mt-12">
        <div className="flex items-center justify-between bg-[#141B2D]/50 backdrop-blur-md p-6 rounded-2xl border border-[#1E293B]/60 shadow-xl shadow-black/20">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-3">
              <span className="font-[family-name:var(--font-geist-mono)] text-[#00D4AA] font-extralight tracking-[0.2em] logo-sweep"><span className="logo-letter">aura</span></span> 
              <span className="text-[#374151]">/</span> go
            </h1>
            <p className="text-sm text-[#8B95A8]">Quick access links for Noor.</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF4D6A]/10 text-[#FF4D6A] hover:bg-[#FF4D6A]/20 border border-[#FF4D6A]/10 hover:border-[#FF4D6A]/30 transition-all text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {links.map((link) => {
            const Icon = link.icon
            const isExt = link.external
            const Tag = isExt ? 'a' : Link
            const props = isExt ? { href: link.href, target: '_blank', rel: 'noopener noreferrer' } : { href: link.href }
            
            return (
              <Tag
                key={link.name}
                {...props}
                className="group flex items-start gap-4 p-5 rounded-2xl bg-[#141B2D]/40 backdrop-blur-sm border border-[#1E293B]/60 hover:border-[#00D4AA]/30 hover:bg-[#141B2D]/80 hover:-translate-y-1 transition-all duration-300 shadow-lg shadow-black/10"
              >
                <div className="p-3 rounded-xl bg-[#0A0F1A] border border-[#1E293B]/80 group-hover:border-[#00D4AA]/30 group-hover:shadow-[0_0_15px_rgba(0,212,170,0.15)] text-[#64748B] group-hover:text-[#00D4AA] transition-all duration-300">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-medium text-[#F1F5F9] group-hover:text-white transition-colors">{link.name}</h2>
                  <p className="text-xs text-[#64748B] mt-1 leading-relaxed">{link.desc}</p>
                </div>
              </Tag>
            )
          })}
        </div>
      </div>
    </div>
  )
}
