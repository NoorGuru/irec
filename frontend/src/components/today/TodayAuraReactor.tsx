'use client'

import React from 'react'

interface TodayAuraReactorProps {
  score: number
  direction: 'BUY' | 'SELL'
}

export default function TodayAuraReactor({ score, direction }: TodayAuraReactorProps) {
  const isBuy = direction === 'BUY'
  const baseColor = isBuy ? '#00D4AA' : '#FF4D6A'
  const glowColor = isBuy ? 'rgba(0, 212, 170, 0.4)' : 'rgba(255, 77, 106, 0.4)'

  // Faster pulse for higher conviction
  const pulseDuration = `${Math.max(0.6, 2.2 - (score / 100) * 1.5)}s`

  return (
    <div className="relative flex items-center justify-center w-16 h-16 shrink-0 select-none">
      {/* Reactor Rings */}
      <div
        className="absolute inset-0 rounded-full border border-dashed opacity-25 animate-[spin_25s_linear_infinite]"
        style={{ borderColor: baseColor }}
      />
      <div
        className="absolute inset-2 rounded-full border opacity-30 animate-ping"
        style={{
          borderColor: baseColor,
          animationDuration: pulseDuration,
        }}
      />
      <div
        className="absolute inset-3 rounded-full opacity-20 blur-md"
        style={{
          backgroundColor: baseColor,
          boxShadow: `0 0 12px 4px ${glowColor}`,
        }}
      />

      {/* SVG Arc Gauge */}
      <svg className="w-14 h-14 transform -rotate-90 relative z-10">
        <circle
          cx="28"
          cy="28"
          r="21"
          className="stroke-[#1E293B]"
          strokeWidth="3.5"
          fill="transparent"
        />
        <circle
          cx="28"
          cy="28"
          r="21"
          stroke={baseColor}
          strokeWidth="4"
          fill="transparent"
          strokeDasharray={2 * Math.PI * 21}
          strokeDashoffset={2 * Math.PI * 21 - (score / 100) * (2 * Math.PI * 21)}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 3px ${glowColor})`,
          }}
        />
      </svg>

      {/* Score Text */}
      <div className="absolute flex flex-col items-center justify-center z-20">
        <span className="font-[family-name:var(--font-geist-mono)] text-xs font-black text-[#F1F5F9] leading-none">
          {score}
        </span>
      </div>
    </div>
  )
}
