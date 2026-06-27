export interface RadarConfig {
  slug: string
  name: string
  description: string
  aura: string // Tailwind color class or hex for the glow
  gradient: string // Tailwind classes for the card background gradient
  tickers: string[]
  category: string // Category for filtering (Tech & Innovation, Healthcare, Finance, Energy, Consumer, Emerging Markets, Dividend Aristocrats, Space Technology)
}

export const RADARS: RadarConfig[] = [
  {
    slug: 'mag-7',
    name: 'The Mag 7',
    description: 'The mega-cap tech giants driving major index movements.',
    aura: 'from-[#FFD700]/20 to-[#8A2BE2]/5',
    gradient: 'from-[#FFD700]/10 via-transparent to-transparent',
    tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA'],
    category: 'Tech & Innovation',
  },
  {
    slug: 'mangos',
    name: 'MANGOS',
    description: 'The new AI frontier and next-gen tech leadership.',
    aura: 'from-[#F59E0B]/20 to-[#7B1FA2]/5',
    gradient: 'from-[#F59E0B]/10 via-transparent to-transparent',
    tickers: ['META', 'ANTH', 'NVDA', 'GOOGL', 'OAI', 'SPCX'],
    category: 'Tech & Innovation',
  },
  {
    slug: 'ai-infrastructure',
    name: 'AI Infrastructure',
    description: 'The hardware and foundry backbone of artificial intelligence.',
    aura: 'from-[#00E5FF]/20 to-[#00B0FF]/5',
    gradient: 'from-[#00E5FF]/10 via-transparent to-transparent',
    tickers: ['AMD', 'SMCI', 'TSM', 'ASML', 'ARM', 'PLTR', 'MU'],
    category: 'Tech & Innovation',
  },
  {
    slug: 'glp-1',
    name: 'GLP-1 & Bio',
    description: 'The massive biotech wave driven by weight-loss drugs.',
    aura: 'from-[#6366F1]/20 to-[#1DE9B6]/5',
    gradient: 'from-[#6366F1]/10 via-transparent to-transparent',
    tickers: ['LLY', 'NVO', 'AMGN', 'VKTX'],
    category: 'Healthcare',
  },
  {
    slug: 'crypto-proxies',
    name: 'Bitcoin Proxies',
    description: 'Public companies acting as high-beta plays on cryptocurrency.',
    aura: 'from-[#FF9100]/20 to-[#FF3D00]/5',
    gradient: 'from-[#FF9100]/10 via-transparent to-transparent',
    tickers: ['MSTR', 'COIN', 'MARA', 'RIOT', 'IBIT'],
    category: 'Finance',
  },
  {
    slug: 'defense',
    name: 'Defense & Aero',
    description: 'Aerospace and tactical contractors amidst global rearmament.',
    aura: 'from-[#FFAB00]/20 to-[#FF6D00]/5',
    gradient: 'from-[#FFAB00]/10 via-transparent to-transparent',
    tickers: ['LMT', 'RTX', 'NOC', 'GD'],
    category: 'Defense',
  },
  {
    slug: 'ai-semiconductors',
    name: 'AI Semiconductors',
    description: 'Specialized hardware and chips designed to power AI workloads.',
    aura: 'from-[#FF00FF]/20 to-[#00FFFF]/5',
    gradient: 'from-[#FF00FF]/10 via-transparent to-transparent',
    tickers: ['NVDA', 'AMD', 'TSM', 'QCOM', 'ARM', 'MTK'],
    category: 'Tech & Innovation',
  },
  {
    slug: 'cloud-computing',
    name: 'Cloud Computing',
    description: 'Providers of on-demand computing services including cloud storage, servers, and AI-powered solutions.',
    aura: 'from-[#00FF00]/20 to-[#0000FF]/5',
    gradient: 'from-[#00FF00]/10 via-transparent to-transparent',
    tickers: ['AMZN', 'MSFT', 'GOOGL', 'CRM', 'ADBE', 'SNOW', 'DDOG'],
    category: 'Tech & Innovation',
  },
  {
    slug: 'renewable-energy',
    name: 'Renewable Energy',
    description: 'Companies involved in solar, wind, battery storage, and clean energy solutions.',
    aura: 'from-[#00FF7F]/20 to-[#FFD700]/5',
    gradient: 'from-[#00FF7F]/10 via-transparent to-transparent',
    tickers: ['NEE', 'ENPH', 'TSLA', 'FSLR', 'RUN'],
    category: 'Energy',
  },
  {
    slug: 'dividend-aristocrats',
    name: 'Dividend Aristocrats',
    description: 'S&P 500 companies with 25+ consecutive years of dividend increases.',
    aura: 'from-[#FFA500]/20 to-[#8B4513]/5',
    gradient: 'from-[#FFA500]/10 via-transparent to-transparent',
    tickers: ['KO', 'JNJ', 'PG', 'MMM', 'ABT', 'CL', 'EMR'],
    category: 'Dividend Aristocrats',
  },
  {
    slug: 'fintech',
    name: 'Fintech & Payments',
    description: 'Technology-driven financial services and digital payment solutions.',
    aura: 'from-[#FF6B6B]/20 to-[#4ECDC4]/5',
    gradient: 'from-[#FF6B6B]/10 via-transparent to-transparent',
    tickers: ['PYPL', 'SQ', 'V', 'MA', 'ADYEY', 'FIS'],
    category: 'Finance',
  },
  {
    slug: 'emerging-markets',
    name: 'Emerging Markets',
    description: 'High-growth companies from developing economies in Asia, Latin America, and Africa.',
    aura: 'from-[#9C27B0]/20 to-[#3F51B5]/5',
    gradient: 'from-[#9C27B0]/10 via-transparent to-transparent',
    tickers: ['BABA', 'TCEHY', 'HDB', 'IBN', 'NU'],
    category: 'Emerging Markets',
  },
  {
    slug: 'cybersecurity',
    name: 'Cybersecurity',
    description: 'Companies providing software, hardware, and services to protect against cyber threats.',
    aura: 'from-[#FF0000]/20 to-[#FF6347]/5',
    gradient: 'from-[#FF0000]/10 via-transparent to-transparent',
    tickers: ['CRWD', 'PANW', 'ZS', 'FTNT', 'CSCO'],
    category: 'Tech & Innovation',
  },
  {
    slug: 'space-technology',
    name: 'Space Technology',
    description: 'Companies involved in satellite manufacturing, launch services, and space exploration.',
    aura: 'from-[#00BFFF]/20 to-[#1E90FF]/5',
    gradient: 'from-[#00BFFF]/10 via-transparent to-transparent',
    tickers: ['RKLB', 'ASTR', 'MAXR'],
    category: 'Space Technology',
  },
]

export function getRadarBySlug(slug: string): RadarConfig | undefined {
  return RADARS.find(r => r.slug === slug)
}

export function getRadarsForTicker(ticker: string): RadarConfig[] {
  // Try to find if this ticker belongs to any radars
  return RADARS.filter(r => r.tickers.includes(ticker))
}
