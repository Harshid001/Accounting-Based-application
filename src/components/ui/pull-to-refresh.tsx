"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface PullToRefreshProps {
  children: React.ReactNode
}

export function PullToRefresh({ children }: PullToRefreshProps) {
  const router = useRouter()
  
  const [startY, setStartY] = useState<number>(0)
  const [currentY, setCurrentY] = useState<number>(0)
  const [refreshing, setRefreshing] = useState(false)
  const [pulling, setPulling] = useState(false)
  
  // Height the pull must reach to trigger a refresh
  const threshold = 80

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only pull to refresh if we are at the very top of the window
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY === 0) return

    const y = e.touches[0].clientY
    const pullDistance = y - startY

    // If pulling down
    if (pullDistance > 0) {
      setPulling(true)
      setCurrentY(pullDistance)
      // Prevent native scroll chaining if pulling heavily (optional, sometimes tricky with passive events)
      if (pullDistance > 10 && e.cancelable) {
        e.preventDefault()
      }
    }
  }

  const handleTouchEnd = () => {
    if (startY === 0) return

    if (currentY >= threshold) {
      setRefreshing(true)
      // Execute the refresh
      router.refresh()
      // Simulate network delay / minimum time for spinner
      setTimeout(() => {
        setRefreshing(false)
      }, 1000)
    }

    setStartY(0)
    setCurrentY(0)
    setPulling(false)
  }

  // Calculate visual translateY using a friction formula so it doesn't just scroll 1:1 linearly
  const translateY = refreshing 
    ? 50 
    : (pulling ? Math.min(currentY * 0.4, threshold + 20) : 0)

  return (
    <div
      className="relative w-full min-h-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* The refresh indicator that gets pulled down */}
      <div 
        className={cn(
          "absolute top-0 left-0 right-0 flex justify-center items-center z-50 pointer-events-none transition-transform",
          !pulling && "duration-300" 
        )}
        style={{
          transform: `translateY(${translateY - 50}px)`,
          opacity: Math.min(translateY / 50, 1)
        }}
      >
        <div className="bg-card shadow-lg rounded-full p-2 border border-border">
          <Loader2 
            className={cn(
              "h-6 w-6 text-primary", 
              refreshing ? "animate-spin" : ""
            )} 
            style={{
              transform: !refreshing ? `rotate(${currentY * 2}deg)` : undefined
            }}
          />
        </div>
      </div>

      {/* The main content that also gets pulled down playfully */}
      <div 
        className={cn(
          "w-full h-full transition-transform",
          !pulling && "duration-300"
        )}
        style={{
          transform: `translateY(${translateY}px)`
        }}
      >
        {children}
      </div>
    </div>
  )
}
