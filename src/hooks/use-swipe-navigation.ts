"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

export function useSwipeNavigation() {
  const router = useRouter()
  const touchStart = useRef<number | null>(null)
  const touchEnd = useRef<number | null>(null)

  // Minimum swipe distance (in px) to trigger navigation
  const minSwipeDistance = 75
  // Maximum distance from left edge to start the swipe (in px)
  const maxEdgeDistance = 40

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      touchEnd.current = null // Reset
      const touch = e.targetTouches[0]
      // Only register start if it's from the left edge
      if (touch.clientX < maxEdgeDistance) {
        touchStart.current = touch.clientX
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      // If we didn't start at the edge, don't track movement
      if (touchStart.current === null) return
      touchEnd.current = e.targetTouches[0].clientX
    }

    const onTouchEnd = () => {
      if (!touchStart.current || !touchEnd.current) {
        touchStart.current = null
        return
      }
      
      const distance = touchEnd.current - touchStart.current
      const isSwipeRight = distance > minSwipeDistance

      if (isSwipeRight) {
        router.back()
      }

      // Reset
      touchStart.current = null
      touchEnd.current = null
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true })
    document.addEventListener("touchmove", onTouchMove, { passive: true })
    document.addEventListener("touchend", onTouchEnd)

    return () => {
      document.removeEventListener("touchstart", onTouchStart)
      document.removeEventListener("touchmove", onTouchMove)
      document.removeEventListener("touchend", onTouchEnd)
    }
  }, [router])
}
