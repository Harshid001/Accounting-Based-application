"use client"

import { useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"

export function useAndroidBackButton() {
  const router = useRouter()
  const pathname = usePathname()
  
  // Keep track of the current pathname in a ref so the popstate listener always has the latest value
  // without needing to be re-bound on every route change (which would mess up history).
  const pathnameRef = useRef(pathname)
  
  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  useEffect(() => {
    // If we're at a top-level route where exiting the app makes sense, don't intervene.
    if (pathname === "/dashboard" || pathname === "/login" || pathname === "/") {
      return
    }

    // In a PWA, if history.length is 1 or 2, pressing back will likely exit the app.
    // By pushing a dummy state, we force the back button to trigger a `popstate` event
    // instead of letting Android kill the app.
    
    // To prevent infinitely growing the history stack on normal forward navigation,
    // we only set the trap if we are at the bottom of the history stack.
    const isAtHistoryRoot = window.history.length <= 2
    
    if (isAtHistoryRoot) {
      window.history.pushState({ pwaTrap: true }, "")
      
      const handlePopState = (e: PopStateEvent) => {
        // The user pressed the hardware back button, popping our dummy state.
        
        // Parse the current path to figure out the logical parent
        const currentPath = pathnameRef.current
        const segments = currentPath.split("/").filter(Boolean)
        
        if (segments.length > 1) {
          // e.g. /dashboard/tasks/new -> /dashboard/tasks
          segments.pop()
          const parentRoute = "/" + segments.join("/")
          router.replace(parentRoute)
        } else {
          // Fallback
          router.replace("/dashboard")
        }
      }
      
      window.addEventListener("popstate", handlePopState)
      
      return () => {
        window.removeEventListener("popstate", handlePopState)
      }
    }
  }, [router]) // Run once on mount or when router changes. Pathname changes are handled via ref.
}
