'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Loader2, LogOut } from 'lucide-react'

// Components
import { AuthGate } from './components/AuthGate'
import { UrlInputHero } from './components/UrlInputHero'
import { JobCard } from './components/JobCard'
import { FailedIngestions } from './components/FailedIngestions'
import { RecentResults } from './components/RecentResults'
import { AutopilotSection } from './components/AutopilotSection'

// Types
import { JobConfig, FailedIngestion } from './components/types'

function IngestContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isDemo = searchParams.get('demo') === '1'
  
  const [jobs, setJobs] = useState<JobConfig[]>([])
  const [failedIngestions, setFailedIngestions] = useState<FailedIngestion[]>([])
  
  // Auth state
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('aura_failed_ingestions')
      if (stored) {
        setFailedIngestions(JSON.parse(stored))
      }
    } catch {}
  }, [])

  const addFailedIngestion = useCallback((failedUrl: string, errorMsg: string) => {
    setFailedIngestions(prev => {
      const filtered = prev.filter(f => f.url !== failedUrl)
      const updated = [{ url: failedUrl, error: errorMsg, timestamp: Date.now() }, ...filtered].slice(0, 20)
      localStorage.setItem('aura_failed_ingestions', JSON.stringify(updated))
      return updated
    })
  }, [])

  const removeFailedIngestion = useCallback((successUrl: string) => {
    setFailedIngestions(prev => {
      const updated = prev.filter(f => f.url !== successUrl)
      localStorage.setItem('aura_failed_ingestions', JSON.stringify(updated))
      return updated
    })
  }, [])

  const handleAddJob = useCallback((job: JobConfig) => {
    setJobs(prev => [job, ...prev])
  }, [])

  const handleDismissJob = useCallback((id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id))
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/admin/login')
  }

  const handleAuthChange = useCallback((isAuthenticated: boolean, email: string | null) => {
    setUserEmail(email)
    if (email) {
      const firstName = email.split('@')[0]
      setDisplayName(firstName)
    } else {
      setDisplayName(null)
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-[#0A0F1A]">
      {/* ─── Top navigation bar ─── */}
      <header className="sticky top-0 z-50 border-b border-[#1E293B]/60 bg-[#0A0F1A]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-extralight tracking-[0.2em] text-[#F1F5F9]/60 hover:text-[#F1F5F9] transition-colors">
              aura
            </Link>
            <span className="text-[#1E293B]">/</span>
            <Link href="/admin" className="font-[family-name:var(--font-geist-mono)] text-xs text-[#8B95A8] hover:text-[#F1F5F9] transition-colors tracking-wider">
              admin
            </Link>
            <span className="text-[#1E293B]">/</span>
            <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[#00D4AA]/70 tracking-wider">
              ingest
            </span>
          </div>

          <div className="flex items-center gap-3">
            {userEmail && (
              <span className="hidden sm:inline text-[11px] text-[#64748B] font-[family-name:var(--font-geist-mono)]">
                {displayName}
              </span>
            )}
            {isDemo && (
              <span className="text-[10px] font-[family-name:var(--font-geist-mono)] text-[#F59E0B]/70 border border-[#F59E0B]/20 rounded px-2 py-0.5 uppercase tracking-wider">
                Demo
              </span>
            )}
            {(!isDemo && userEmail) && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-[#8B95A8] hover:text-[#F1F5F9] hover:bg-[#141B2D] transition-all"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ─── Main content ─── */}
      <main className="flex-1 px-5 py-12 md:py-20">
        <div className="mx-auto w-full max-w-4xl space-y-12">
          
          <AuthGate isDemo={isDemo} onAuthChange={handleAuthChange}>
            {/* ─── Hero & URL Input ─── */}
            <UrlInputHero onAddJob={handleAddJob} />
            
            {/* ─── Active Jobs ─── */}
            {jobs.length > 0 && (
              <div className="space-y-6 mt-12 animate-fade-up">
                <div className="flex items-center gap-3">
                  <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#64748B]">Active Jobs</h2>
                  <div className="h-px bg-[#1E293B] flex-1" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {jobs.map(job => (
                    <JobCard 
                      key={job.id} 
                      config={job} 
                      onDismiss={handleDismissJob}
                      onFailed={addFailedIngestion}
                      onSuccess={removeFailedIngestion}
                      isDemo={isDemo}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ─── Autopilot Section ─── */}
            <div className="mt-12 animate-fade-up">
              <AutopilotSection isDemo={isDemo} />
            </div>
          </AuthGate>

          {/* ─── Recent Results (Always visible, read-only) ─── */}
          <div className="animate-fade-up stagger-3">
            <RecentResults />
          </div>

          {/* ─── Failed Ingestions ─── */}
          <FailedIngestions 
            failedIngestions={failedIngestions}
            onClearAll={() => {
              setFailedIngestions([])
              localStorage.removeItem('aura_failed_ingestions')
            }}
            onRetry={(url) => {
              handleAddJob({
                id: Math.random().toString(36).substring(2, 9),
                url,
                mode: 'normal'
              })
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            onRemove={removeFailedIngestion}
          />
          
        </div>
      </main>
    </div>
  )
}

export default function IngestPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0A0F1A]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-5 w-5 animate-spin text-[#00D4AA]/60" />
            <p className="text-xs text-[#64748B] tracking-wide">Loading...</p>
          </div>
        </div>
      }
    >
      <IngestContent />
    </Suspense>
  )
}
