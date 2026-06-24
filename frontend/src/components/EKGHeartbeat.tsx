'use client'

import { motion } from 'framer-motion'

export default function EKGHeartbeat({
  overallMood,
  direction,
}: {
  overallMood: string
  direction: 'BUY' | 'SELL' | 'NEUTRAL'
}) {
  const strokeColor =
    direction === 'BUY' ? '#00D4AA' : direction === 'SELL' ? '#FF4D6A' : '#8B95A8'

  // Heart rate speed based on sentiment mood
  let duration = '2s'
  if (overallMood === 'Bullish' || overallMood.includes('Bull')) {
    duration = '1.3s'
  } else if (overallMood === 'Bearish' || overallMood.includes('Bear')) {
    duration = '3.5s'
  }

  return (
    <div className="absolute inset-x-0 bottom-0 h-20 overflow-hidden pointer-events-none opacity-25 z-0">
      <svg className="w-full h-full" viewBox="0 0 1000 100" preserveAspectRatio="none">
        <defs>
          <pattern id="ekgGrid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#1E293B" strokeWidth="0.5" opacity="0.4" />
          </pattern>
          <linearGradient id="ekgGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0" />
            <stop offset="35%" stopColor={strokeColor} stopOpacity="0.1" />
            <stop offset="48%" stopColor={strokeColor} stopOpacity="0.4" />
            <stop offset="50%" stopColor={strokeColor} stopOpacity="1" />
            <stop offset="52%" stopColor={strokeColor} stopOpacity="0.4" />
            <stop offset="65%" stopColor={strokeColor} stopOpacity="0.1" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <rect width="100%" height="100%" fill="url(#ekgGrid)" />

        {/* Static Background Guide */}
        <path
          d="M 0 50 L 150 50 L 160 40 L 170 60 L 180 15 L 195 90 L 205 45 L 215 53 L 230 50 L 450 50 L 460 40 L 470 60 L 480 15 L 495 90 L 505 45 L 515 53 L 530 50 L 750 50 L 760 40 L 770 60 L 780 15 L 795 90 L 805 45 L 815 53 L 830 50 L 1000 50"
          fill="none"
          stroke="#1E293B"
          strokeWidth="1.5"
          opacity="0.3"
        />

        {/* Animated Heartbeat scanning glow */}
        <motion.path
          d="M 0 50 L 150 50 L 160 40 L 170 60 L 180 15 L 195 90 L 205 45 L 215 53 L 230 50 L 450 50 L 460 40 L 470 60 L 480 15 L 495 90 L 505 45 L 515 53 L 530 50 L 750 50 L 760 40 L 770 60 L 780 15 L 795 90 L 805 45 L 815 53 L 830 50 L 1000 50"
          fill="none"
          stroke="url(#ekgGradient)"
          strokeWidth="2.5"
          strokeDasharray="1000"
          animate={{ strokeDashoffset: [1000, -1000] }}
          transition={{
            repeat: Infinity,
            duration: parseFloat(duration),
            ease: "linear",
          }}
          style={{
            filter: `drop-shadow(0 0 6px ${strokeColor})`,
          }}
        />
      </svg>
    </div>
  )
}
