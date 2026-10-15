import { Play, TopAlphaPlay, InvestorArchetype } from './types'
import { normalizeAvgConviction100 } from './utils'

/**
 * Synthesizes a clean 1-sentence executive thesis for an alpha play.
 * Avoids verbose transcript fragments by extracting the core premise
 * and joining with consensus proof.
 */
export function synthesizeExecutiveThesis(play: Play): string {
  let premise = ''
  if (play.top_catalyst && play.top_catalyst.trim().length > 0) {
    // Split on first period, semicolon, or em-dash
    const parts = play.top_catalyst.split(/[.;—]/)
    const firstClean = parts[0]?.trim() || ''
    if (firstClean.length >= 15) {
      premise = firstClean
    }
  }

  if (!premise && play.why_bullets && play.why_bullets.length > 0) {
    premise = play.why_bullets[0]
  }

  if (!premise) {
    premise = `${play.stock_name} shows strong bullish institutional and creator momentum`
  }

  // Ensure premise ends cleanly
  premise = premise.replace(/[,;—\s]+$/, '')

  // Contextual consensus proof
  let consensusSuffix = ''
  if (play.analyst_count >= 4 && play.agreement_pct >= 88) {
    consensusSuffix = `backed by unanimous consensus across ${play.analyst_count} top channels.`
  } else if (play.analyst_count >= 2) {
    consensusSuffix = `with ${play.agreement_pct}% consensus across ${play.analyst_count} channels.`
  } else {
    consensusSuffix = `with strong ${Math.round(normalizeAvgConviction100(play.avg_conviction))}/100 conviction.`
  }

  return `${premise} ${consensusSuffix}`
}

/**
 * Classify a play into an investor archetype based on quantitative signals.
 */
export function classifyArchetype(play: Play): { archetype: 'core' | 'growth' | 'value'; label: string } {
  const conviction = normalizeAvgConviction100(play.avg_conviction)

  // 1. Core Heavyweights: High multi-channel consensus pillars
  if (play.analyst_count >= 5 && play.agreement_pct >= 85 && play.aura_score >= 68) {
    return { archetype: 'core', label: 'Core Heavyweight' }
  }

  // 2. Value / Target Gap: Notable price target upside
  if (play.avg_target_price !== null && play.avg_target_price > 0 && play.aura_score >= 60) {
    return { archetype: 'value', label: 'Target Upside' }
  }

  // 3. Growth Momentum: Rapid buzz velocity or high conviction
  if (conviction >= 65 || play.recent_mentions >= 3) {
    return { archetype: 'growth', label: 'Growth Momentum' }
  }

  // Fallback defaults
  if (play.analyst_count >= 3) {
    return { archetype: 'core', label: 'Core Pillar' }
  }
  return { archetype: 'growth', label: 'Growth Momentum' }
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
 * Extracts the top 5 to 10 stocks to buy from the trailing 30-day window.
 */
export function filterTopBuyPlays(
  plays: Play[],
  limit = 10,
  archetypeFilter: InvestorArchetype = 'all'
): TopAlphaPlay[] {
  if (!plays || plays.length === 0) return []

  // Direction: strictly BUY
  const buyPlays = plays.filter((p) => p.direction === 'BUY')
  if (buyPlays.length === 0) return []

  // Stage 0: Strict Quality Gate
  let candidates = buyPlays.filter(
    (p) =>
      p.analyst_count >= 3 &&
      p.agreement_pct >= 80 &&
      normalizeAvgConviction100(p.avg_conviction) >= 55.0 &&
      p.aura_score >= 60
  )

  // Stage 1 Relaxation: If fewer candidates than needed, relax analyst count & aura
  if (candidates.length < Math.min(5, limit)) {
    candidates = buyPlays.filter(
      (p) =>
        p.analyst_count >= 2 &&
        p.agreement_pct >= 75 &&
        normalizeAvgConviction100(p.avg_conviction) >= 50.0 &&
        p.aura_score >= 50
    )
  }

  // Stage 2 Relaxation (Emergency/Market lull): Take top scoring plays
  if (candidates.length < Math.min(5, limit)) {
    candidates = buyPlays.filter((p) => p.aura_score >= 35)
  }

  // Sort candidates by APM and deterministic tie-breakers
  const sorted = [...candidates].sort((a, b) => {
    const apmA = calculateAPM(a)
    const apmB = calculateAPM(b)
    if (apmB !== apmA) return apmB - apmA
    if (b.analyst_count !== a.analyst_count) return b.analyst_count - a.analyst_count
    if (b.agreement_pct !== a.agreement_pct) return b.agreement_pct - a.agreement_pct
    return b.recent_mentions - a.recent_mentions
  })

  // Assemble enriched TopAlphaPlay objects
  const enriched: TopAlphaPlay[] = sorted.slice(0, Math.max(10, limit)).map((p, index) => {
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
    const filtered = enriched.filter((p) => p.archetype === archetypeFilter)
    if (filtered.length >= 2) {
      return filtered.slice(0, limit)
    }
    // If not enough match specific archetype, return top unfiltered
  }

  return enriched.slice(0, limit)
}
