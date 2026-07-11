import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export function SectionCollapse({
  id,
  title,
  count,
  defaultExpanded = false,
  children,
  icon: Icon
}: {
  id: string
  title: string
  count?: number
  defaultExpanded?: boolean
  children: React.ReactNode
  icon?: React.ElementType
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  useEffect(() => {
    const stored = localStorage.getItem(`aura_section_${id}`)
    if (stored !== null) {
      setIsExpanded(stored === 'true')
    }
  }, [id])

  const toggle = () => {
    setIsExpanded(prev => {
      const next = !prev
      localStorage.setItem(`aura_section_${id}`, String(next))
      return next
    })
  }

  return (
    <div className="rounded-2xl border border-[#1E293B] bg-[#141B2D]/40 overflow-hidden">
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between px-5 py-4 hover:bg-[#1E293B]/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className="h-4 w-4 text-[#00D4AA]" />}
          <h2 className="text-sm font-bold tracking-wide text-[#F1F5F9]">{title}</h2>
          {count !== undefined && count > 0 && (
            <span className="rounded-full bg-[#1E293B] px-2.5 py-0.5 text-[10px] font-medium text-[#8B95A8]">
              {count}
            </span>
          )}
        </div>
        <div className="text-[#8B95A8]">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      <div
        className={`transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-5 pb-5 border-t border-[#1E293B]/50 pt-5">
          {children}
        </div>
      </div>
    </div>
  )
}
