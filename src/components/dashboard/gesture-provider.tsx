"use client"

import React from "react"
import { useSwipeNavigation } from "@/hooks/use-swipe-navigation"
import { useAndroidBackButton } from "@/hooks/use-android-back-button"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"

export function GestureProvider({ children }: { children: React.ReactNode }) {
  // Initialize edge-swipe back navigation
  useSwipeNavigation()
  // Initialize hardware back button trap
  useAndroidBackButton()

  return (
    <PullToRefresh>
      {children}
    </PullToRefresh>
  )
}
