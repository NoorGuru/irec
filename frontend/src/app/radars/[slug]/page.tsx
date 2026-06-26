import { RADARS } from '@/lib/radars'
import RadarDetailClient from './RadarDetailClient'

export function generateStaticParams() {
  return RADARS.map((radar) => ({
    slug: radar.slug,
  }))
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <RadarDetailClient slug={slug} />
}
