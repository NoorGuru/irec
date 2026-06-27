'use client'

import { useEffect, useRef } from 'react'

export default function PulseField({
  overallMood,
  direction,
}: {
  overallMood: string
  direction: 'BUY' | 'SELL' | 'NEUTRAL'
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let time = 0

    const isBull = overallMood === 'Bullish' || overallMood.includes('Bull')
    const isBear = overallMood === 'Bearish' || overallMood.includes('Bear')
    
    // Config based on mood
    const baseColor = direction === 'BUY' ? '0, 212, 170' : direction === 'SELL' ? '255, 77, 106' : '139, 149, 168'
    const speed = isBull ? 0.012 : isBear ? 0.004 : 0.008
    const volatility = isBull ? 0.8 : isBear ? 0.3 : 0.5 // Higher peaks for bulls, flat for bears
    
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    
    window.addEventListener('resize', resize)
    resize()

    const render = () => {
      time += speed
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      const width = canvas.offsetWidth
      const height = canvas.offsetHeight
      
      const barWidth = 4
      const gap = 4
      const numBars = Math.floor(width / (barWidth + gap))
      
      for (let i = 0; i < numBars; i++) {
        // Generate pseudo-random, flowing noise using sine waves
        const noise1 = Math.sin(i * 0.1 + time)
        const noise2 = Math.sin(i * 0.05 - time * 0.8)
        const noise3 = Math.sin(i * 0.2 + time * 1.5)
        
        let combinedNoise = (noise1 + noise2 + noise3) / 3
        
        // Base height calculation
        const minHeight = height * 0.1
        const activeHeight = Math.max(0, combinedNoise * volatility * height)
        
        const finalHeight = minHeight + activeHeight
        const x = i * (barWidth + gap)
        const y = height - finalHeight
        
        // Fade out edges
        const distanceFromCenter = Math.abs(i - numBars / 2) / (numBars / 2)
        const edgeFade = Math.max(0.1, 1 - Math.pow(distanceFromCenter, 2))
        
        // Dynamic opacity based on height
        const intensity = (finalHeight / height) * 0.8 + 0.2
        const alpha = intensity * edgeFade * 0.6
        
        ctx.fillStyle = `rgba(${baseColor}, ${alpha})`
        
        // Draw rounded bar
        ctx.beginPath()
        ctx.roundRect(x, y, barWidth, finalHeight, 2)
        ctx.fill()
        
        // Add core bright streak to tall bars
        if (intensity > 0.6) {
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`
          ctx.beginPath()
          ctx.roundRect(x + 1, y, barWidth - 2, finalHeight * 0.8, 1)
          ctx.fill()
        }
      }
      
      animationFrameId = window.requestAnimationFrame(render)
    }
    
    render()

    return () => {
      window.removeEventListener('resize', resize)
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [overallMood, direction])

  return (
    <div className="absolute inset-x-0 bottom-0 h-32 overflow-hidden pointer-events-none opacity-40 z-0 select-none mix-blend-screen">
       {/* Fade masks top/bottom */}
       <div className="absolute inset-0 bg-gradient-to-b from-[#141B2D]/0 via-transparent to-[#141B2D]/90 z-10" />
       {/* Fade masks left/right */}
       <div className="absolute inset-0 bg-gradient-to-r from-[#141B2D] via-transparent to-[#141B2D] z-10" />
       <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  )
}
