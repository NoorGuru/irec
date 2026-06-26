export interface RadarConfig {
  slug: string
  name: string
  description: string
  aura: string // Tailwind color class or hex for the glow
  gradient: string // Tailwind classes for the card background gradient
  tickers: string[]
}

export const RADARS: RadarConfig[] = [
  {
    slug: 'mag-7',
    name: 'The Mag 7',
    description: 'The mega-cap tech giants driving major index movements.',
    aura: 'from-[#FFD700]/20 to-[#8A2BE2]/5',
    gradient: 'from-[#FFD700]/10 via-transparent to-transparent',
    tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA'],
  },
  {
    slug: 'mangos',
    name: 'MANGOS',
    description: 'The new AI frontier and next-gen tech leadership.',
    aura: 'from-[#F59E0B]/20 to-[#7B1FA2]/5',
    gradient: 'from-[#F59E0B]/10 via-transparent to-transparent',
    tickers: ['META', 'ANTH', 'NVDA', 'GOOGL', 'OAI', 'SPCX'],
  },
  {
    slug: 'ai-infrastructure',
    name: 'AI Infrastructure',
    description: 'The hardware and foundry backbone of artificial intelligence.',
    aura: 'from-[#00E5FF]/20 to-[#00B0FF]/5',
    gradient: 'from-[#00E5FF]/10 via-transparent to-transparent',
    tickers: ['AMD', 'SMCI', 'TSM', 'ASML', 'ARM', 'PLTR', 'MU'],
  },
  {
    slug: 'glp-1',
    name: 'GLP-1 & Bio',
    description: 'The massive biotech wave driven by weight-loss drugs.',
    aura: 'from-[#6366F1]/20 to-[#1DE9B6]/5',
    gradient: 'from-[#6366F1]/10 via-transparent to-transparent',
    tickers: ['LLY', 'NVO', 'AMGN', 'VKTX'],
  },
  {
    slug: 'crypto-proxies',
    name: 'Bitcoin Proxies',
    description: 'Public companies acting as high-beta plays on cryptocurrency.',
    aura: 'from-[#FF9100]/20 to-[#FF3D00]/5',
    gradient: 'from-[#FF9100]/10 via-transparent to-transparent',
    tickers: ['MSTR', 'COIN', 'MARA', 'RIOT', 'IBIT'],
  },
  {
    slug: 'defense',
    name: 'Defense & Aero',
    description: 'Aerospace and tactical contractors amidst global rearmament.',
    aura: 'from-[#FFAB00]/20 to-[#FF6D00]/5',
    gradient: 'from-[#FFAB00]/10 via-transparent to-transparent',
    tickers: ['LMT', 'RTX', 'NOC', 'GD'],
  },
]

export function getRadarBySlug(slug: string): RadarConfig | undefined {
  return RADARS.find(r => r.slug === slug)
}

export function getRadarsForTicker(ticker: string): RadarConfig[] {
  // Try to find if this ticker belongs to any radars
  return RADARS.filter(r => r.tickers.includes(ticker))
}
