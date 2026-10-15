'use client'

import TopAlphaSection, { TopAlphaSkeleton, TopAlphaSectionProps } from '@/components/alpha/TopAlphaSection'

export type HomeTopAlphaProps = TopAlphaSectionProps
export const HomeTopAlphaSkeleton = TopAlphaSkeleton

export default function HomeTopAlpha(props: HomeTopAlphaProps) {
  return <TopAlphaSection {...props} variant="compact" showScreenerLink={true} />
}
