export function Footer() {
  return (
    <footer className="mt-auto w-full pt-16 pb-8 px-6 md:px-12" role="contentinfo">
      {/* The signature line — one row, everything on one axis */}
      <div className="max-w-4xl mx-auto flex items-center justify-center gap-4">
        {/* Left whisker */}
        <div className="hidden sm:block flex-1 h-px bg-gradient-to-r from-transparent to-[#1E293B]" />

        {/* The mark */}
        <a
          href="https://bynoor.io"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex items-center gap-1.5 px-4 py-2"
        >
          {/* Hover aura — tiny radial glow */}
          <div
            className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(0,212,170,0.06) 0%, transparent 70%)',
            }}
            aria-hidden="true"
          />
          <span className="relative text-[11px] tracking-[0.18em] text-[#475569] group-hover:text-[#64748B] transition-colors duration-300">
            by
          </span>
          <span className="relative font-[family-name:var(--font-geist-mono)] text-[13px] font-medium tracking-[0.08em] text-[#64748B] group-hover:text-[#00D4AA] transition-colors duration-300">
            noor
          </span>
        </a>

        {/* Right whisker */}
        <div className="hidden sm:block flex-1 h-px bg-gradient-to-l from-transparent to-[#1E293B]" />
      </div>

      {/* Sub-line: source + disclaimer — whispered */}
      <div className="max-w-4xl mx-auto mt-4 flex items-center justify-center gap-3 text-[10px] text-[#374151] font-[family-name:var(--font-geist-mono)] tracking-wide">
        <a
          href="https://github.com/NoorGuru/irec"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[#64748B] transition-colors duration-200"
        >
          src
        </a>
        <span aria-hidden="true" className="text-[#1E293B]">·</span>
        <span>not financial advice</span>
      </div>
    </footer>
  )
}
