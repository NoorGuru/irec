'use client'

import React, { useRef, useState, useEffect } from 'react'
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion'

interface HolographicCardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  direction?: 'BUY' | 'SELL'
  isStrong?: boolean
}

export default function HolographicCard({
  children,
  className = '',
  onClick,
  direction = 'BUY',
  isStrong = false,
}: HolographicCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)
  const shouldReduceMotion = useReducedMotion()

  // Motion values for X/Y rotation
  const rotateXVal = useMotionValue(0)
  const rotateYVal = useMotionValue(0)

  // Motion values for glare overlay positioning
  const glareXVal = useMotionValue(50)
  const glareYVal = useMotionValue(50)
  const glareOpacityVal = useMotionValue(0.1)

  // Smooth spring physics configuration
  const springConfig = { damping: 20, stiffness: 150, mass: 0.5 }
  const rotateX = useSpring(rotateXVal, springConfig)
  const rotateY = useSpring(rotateYVal, springConfig)
  const glareX = useSpring(glareXVal, springConfig)
  const glareY = useSpring(glareYVal, springConfig)
  const glareOpacity = useSpring(glareOpacityVal, springConfig)

  // Gyroscope tracking for Mobile
  useEffect(() => {
    if (shouldReduceMotion) return
    let hasGyro = false
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (!cardRef.current || hovered) return
      hasGyro = true
      
      const beta = e.beta || 0
      const gamma = e.gamma || 0

      // Normalize to comfortable tilt angles (-10 to 10 deg)
      // Standard hold angle is around 45deg beta, 0deg gamma
      const normBeta = Math.max(-15, Math.min(15, beta - 45))
      const normGamma = Math.max(-15, Math.min(15, gamma))

      rotateXVal.set(normBeta * -0.6)
      rotateYVal.set(normGamma * 0.6)
      glareXVal.set(50 + normGamma * 2.5)
      glareYVal.set(50 + normBeta * 2.5)
      glareOpacityVal.set(0.15)
    }

    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation)
    }

    // Auto-drift fallback if no gyroscope data is received (e.g. desktop non-hover or mobile without sensor)
    let angle = 0
    const driftInterval = setInterval(() => {
      if (hovered || hasGyro) return
      // Subtle organic drift
      angle += 0.02
      const driftX = 50 + Math.cos(angle) * 15
      const driftY = 50 + Math.sin(angle * 0.8) * 15
      
      glareXVal.set(driftX)
      glareYVal.set(driftY)
      glareOpacityVal.set(0.06 + Math.sin(angle * 1.5) * 0.02)
    }, 30)

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientation', handleOrientation)
      }
      clearInterval(driftInterval)
    }
  }, [hovered, rotateXVal, rotateYVal, glareXVal, glareYVal, glareOpacityVal, shouldReduceMotion])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (shouldReduceMotion) return
    const card = cardRef.current
    if (!card) return

    const rect = card.getBoundingClientRect()
    const width = rect.width
    const height = rect.height

    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const rX = -(mouseY - height / 2) / (height / 2) * 12
    const rY = (mouseX - width / 2) / (width / 2) * 12

    const gX = (mouseX / width) * 100
    const gY = (mouseY / height) * 100

    rotateXVal.set(rX)
    rotateYVal.set(rY)
    glareXVal.set(gX)
    glareYVal.set(gY)
  }

  const handleMouseEnter = () => {
    setHovered(true)
    if (!shouldReduceMotion) {
      glareOpacityVal.set(0.2)
    }
  }

  const handleMouseLeave = () => {
    setHovered(false)
    if (!shouldReduceMotion) {
      rotateXVal.set(0)
      rotateYVal.set(0)
      glareOpacityVal.set(0.04)
    }
  }

  const isBuy = direction === 'BUY'
  
  const shadowValue = useTransform(
    [rotateX, rotateY, glareOpacity],
    ([rx, ry, gOpacity]) => {
      if (shouldReduceMotion || !hovered) return `0 4px 20px rgba(0, 0, 0, 0.4)`
      const shadowX = -Number(ry) * 1.5
      const shadowY = Number(rx) * 1.5
      return `${shadowX}px ${shadowY}px 30px rgba(${isBuy ? '0, 212, 170' : '255, 77, 106'}, ${0.15 + Number(gOpacity) * 0.3})`
    }
  )

  const borderStyle = isBuy 
    ? (isStrong ? 'border-[#00FFD0]/40' : 'border-[#00D4AA]/25')
    : (isStrong ? 'border-[#FF1744]/40' : 'border-[#FF4D6A]/25')

  return (
    <motion.div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      style={{
        transformStyle: shouldReduceMotion ? undefined : 'preserve-3d',
        rotateX: shouldReduceMotion ? 0 : rotateX,
        rotateY: shouldReduceMotion ? 0 : rotateY,
        boxShadow: shadowValue,
      }}
      className={`
        relative group flex flex-col rounded-2xl border bg-[#0B0F19]/90 backdrop-blur-md p-5 md:p-6 transition-all duration-300 cursor-pointer overflow-hidden
        outline-none focus-visible:ring-2 ${isBuy ? 'focus-visible:ring-[#00D4AA]/70 focus-visible:border-[#00D4AA]' : 'focus-visible:ring-[#FF4D6A]/70 focus-visible:border-[#FF4D6A]'}
        ${borderStyle}
        ${isBuy ? 'hover:border-[#00D4AA]/60' : 'hover:border-[#FF4D6A]/60'}
        ${className}
      `}
    >
      {/* Subtle Noise Texture Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.015] mix-blend-overlay z-0" 
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />

      {/* Inner edge-lighting borders */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none border border-t-white/10 border-l-white/10 border-b-transparent border-r-transparent z-10" />

      {/* 3D Content Wrapper */}
      <div style={{ transform: shouldReduceMotion ? undefined : 'translateZ(20px)' }} className="w-full h-full flex flex-col relative z-10">
        {children}
      </div>

      {/* Holographic Sheen/Glare Overlay */}
      {!shouldReduceMotion && (
        <motion.div
          className="absolute inset-0 pointer-events-none mix-blend-color-dodge z-20"
          style={{
            background: useTransform(
              [glareX, glareY, glareOpacity],
              ([x, y, op]) =>
                `radial-gradient(circle at ${x}% ${y}%, rgba(255, 255, 255, ${op}) 0%, rgba(255, 255, 255, 0) 50%), 
                 linear-gradient(${Number(x) + Number(y)}deg, rgba(255,255,255,0) 0%, rgba(255,255,255,${Number(op) * 0.4}) 50%, rgba(255,255,255,0) 100%)`
            ),
            opacity: glareOpacity,
          }}
        />
      )}

      {/* Hover background highlight */}
      <div 
        className={`
          absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-0
          bg-[radial-gradient(circle_at_center,${isBuy ? 'rgba(0,212,170,0.06)' : 'rgba(255,77,106,0.06)'}_0%,transparent_75%)]
        `}
      />
    </motion.div>
  )
}

