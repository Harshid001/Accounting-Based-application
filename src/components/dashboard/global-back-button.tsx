"use client"

import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export function GlobalBackButton() {
  const router = useRouter()
  const pathname = usePathname()
  
  const segments = pathname.split("/").filter(Boolean)
  
  // Only show on sub-pages (e.g., /dashboard/clients/new)
  // Roots are /dashboard (1 segment) and /dashboard/clients (2 segments)
  if (segments.length <= 2) return null

  return (
    <div className="mb-4 animate-fade-in">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => router.back()} 
        className="text-muted-foreground hover:text-foreground bg-background/50 backdrop-blur-sm border-border/50 rounded-xl hover:bg-accent/50 transition-all duration-300"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
    </div>
  )
}
