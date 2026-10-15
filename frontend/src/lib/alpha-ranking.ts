import { Play, TopAlphaPlay, InvestorArchetype } from './types'
import { normalizeAvgConviction100 } from './utils'

export const ALPHA_GATE_CRITERIA = {
  MIN_CHANNELS: 2,
  MIN_AGREEMENT_PCT: 75,
  MIN_CONVICTION: 55.0,
  MIN_AURA_SCORE: 60,
} as const

/**
 * Synthesizes a clean 1-sentence executive thesis for an alpha play.
 * Extracts the core premise without destructive regex splitting
 * and joins with verifiable consensus proof.
 */
export function synthesizeExecutiveThesis(play: Play): string {
  const conviction = Math.round(normalizeAvgConviction100(play.avg_conviction))
  const isUnanimous = play.agreement_pct >= 95

  // Clean catalyst note: ignore placeholder strings
  let cleanCatalyst = (play.top_catalyst || '').trim()
  if (
    cleanCatalyst.toLowerCase().includes('no catalyst notes') ||
    cleanCatalyst.length < 15
  ) {
    cleanCatalyst = ''
  } else {
    // Trim trailing punctuation cleanly
    cleanCatalyst = cleanCatalyst.replace(/[,;—\s]+$/, '')
    if (!cleanCatalyst.endsWith('.')) {
      cleanCatalyst += '.'
    }
  }

  // Consensus proof suffix
  const proof = isUnanimous
    ? `Backed by unanimous buy consensus across ${play.analyst_count} independent channels (${conviction}/100 conviction).`
    : `Backed by ${play.agreement_pct}% bullish consensus across ${play.analyst_count} channels (${conviction}/100 conviction).`

  if (cleanCatalyst) {
    return `${cleanCatalyst} ${proof}`
  }

  if (play.why_bullets && play.why_bullets.length > 0) {
    const bullet = play.why_bullets[0].trim().replace(/[,;—\s]+$/, '')
    return `${bullet}. ${proof}`
  }

  return `High-conviction bullish consensus across ${play.analyst_count} creator channels with ${play.agreement_pct}% agreement and ${conviction}/100 conviction.`
}

/**
 * Classify a play into an investor archetype based on quantitative signals.
 */
export function classifyArchetype(play: Play): { archetype: 'core' | 'growth' | 'value'; label: string } {
  // 1. Consensus Anchor / Heavyweights: 4+ channels with top tier consensus
  if (play.analyst_count >= 4 && play.agreement_pct >= 80) {
    return { archetype: 'core', label: 'Consensus Anchor' }
  }

  // 2. Value / Target Gap: Notable price target upside recorded
  if (play.avg_target_price !== null && play.avg_target_price > 0) {
    return { archetype: 'value', label: 'Target Upside' }
  }

  // 3. Momentum Buy: High conviction or velocity
  return { archetype: 'growth', label: 'Momentum Buy' }
}

/**
 * Calculate Alpha Priority Metric (APM) for deterministic ranking
 */
export function calculateAPM(play: Play): number {
  const conviction = normalizeAvgConviction100(play.avg_conviction)
  let score = play.aura_score
  score += play.agreement_pct * 0.05
  score += Math.min(10, play.analyst_count) * 0.5
  score += conviction * 0.02

  if (play.avg_target_price !== null && play.avg_target_price > 0) {
    score += 1.5
  }

  return Math.round(score * 10) / 10
}

/**
 * Curated Alpha Gate & Ranking Engine.
 * Extracts strictly qualified high-conviction buy plays from the trailing 30-day window.
 * Zero relaxation degradation, zero artificial quota-filling.
 * Dynamic return size: 0 to maxLimit (default 10).
 */
export function filterTopBuyPlays(
  plays: Play[],
  maxLimit = 10,
  archetypeFilter: InvestorArchetype = 'all'
): TopAlphaPlay[] {
  if (!plays || plays.length === 0) return []

  // Strict Single-Tier Hard Gate
  const qualified = plays.filter((p) => {
    if (p.direction !== 'BUY') return false
    if (p.analyst_count < ALPHA_GATE_CRITERIA.MIN_CHANNELS) return false
    if (p.agreement_pct < ALPHA_GATE_CRITERIA.MIN_AGREEMENT_PCT) return false
    if (normalizeAvgConviction100(p.avg_conviction) < ALPHA_GATE_CRITERIA.MIN_CONVICTION) return false
    if (p.aura_score < ALPHA_GATE_CRITERIA.MIN_AURA_SCORE) return false
    return true
  })

  // Deterministic Ranking by APM
  const sorted = [...qualified].sort((a, b) => {
    const apmA = calculateAPM(a)
    const apmB = calculateAPM(b)
    if (apmB !== apmA) return apmB - apmA
    if (b.analyst_count !== a.analyst_count) return b.analyst_count - a.analyst_count
    if (b.agreement_pct !== a.agreement_pct) return b.agreement_pct - a.agreement_pct
    return b.recent_mentions - a.recent_mentions
  })

  // Assemble enriched TopAlphaPlay objects
  const enriched: TopAlphaPlay[] = sorted.map((p, index) => {
    const { archetype, label } = classifyArchetype(p)
    return {
      ...p,
      rank: index + 1,
      apm_score: calculateAPM(p),
      archetype,
      archetype_label: label,
      executive_thesis: synthesizeExecutiveThesis(p),
    }
  })

  // Apply archetype filter if requested
  if (archetypeFilter !== 'all') {
    return enriched.filter((p) => p.archetype === archetypeFilter).slice(0, maxLimit)
  }

  return enriched.slice(0, maxLimit)
}
