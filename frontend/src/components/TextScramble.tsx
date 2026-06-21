'use client'

import { useEffect, useState } from 'react'

interface TextScrambleProps {
  text: string
  duration?: number // duration of scramble in ms
  speed?: number // interval between updates in ms
  className?: string
}

const chars = '!@#$%^&*()_+~`|}{[]:;?><,./-='

export default function TextScramble({
  text,
  duration = 800,
  speed = 30,
  className = '',
}: TextScrambleProps) {
  const [displayText, setDisplayText] = useState(text)

  useEffect(() => {
    let frame = 0
    const totalFrames = Math.floor(duration / speed)
    const textLength = text.length

    const interval = setInterval(() => {
      frame++
      const progress = frame / totalFrames

      if (progress >= 1) {
        setDisplayText(text)
        clearInterval(interval)
        return
      }

      // Calculate how many characters are "revealed"
      const revealedCount = Math.floor(progress * textLength)

      const scrambled = text
        .split('')
        .map((char, index) => {
          if (index < revealedCount) {
            return char
          }
          if (char === ' ') return ' '
          return chars[Math.floor(Math.random() * chars.length)]
        })
        .join('')

      setDisplayText(scrambled)
    }, speed)

    return () => clearInterval(interval)
  }, [text, duration, speed])

  return <span className={className}>{displayText}</span>
}
