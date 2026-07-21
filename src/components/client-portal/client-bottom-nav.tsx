"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FileText,
  ShieldCheck,
  CreditCard,
  MessageSquare
} from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/client-view", label: "Home", icon: LayoutDashboard },
  { href: "/client-view/invoices", label: "Pay", icon: CreditCard },
  { href: "/client-view/documents", label: "Docs", icon: FileText },
  { href: "/client-view/compliance", label: "Taxes", icon: ShieldCheck },
  { href: "/client-view/comments", label: "Chat", icon: MessageSquare },
]

export function ClientBottomNav() {
  const pathname = usePathname()

  // To fit well on mobile, we slice to max 5 items
  const itemsToDisplay = NAV_ITEMS.slice(0, 5)

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex h-[calc(70px+env(safe-area-inset-bottom))] items-center justify-around border-t border-border/40 bg-background/95 pb-[env(safe-area-inset-bottom)] px-2 backdrop-blur-xl transition-all md:hidden">
      {itemsToDisplay.map((item) => {
        const isActive = pathname === item.href
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className="group flex flex-col items-center justify-center gap-1 min-w-[64px] transition-transform active:scale-95"
          >
            <div
              className={cn(
                "flex items-center justify-center rounded-full p-2 transition-all duration-300",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground group-hover:bg-muted/50"
              )}
            >
              <Icon
                className={cn(
                  "transition-all duration-300",
                  isActive ? "h-6 w-6 scale-105" : "h-5 w-5 scale-100"
                )}
                strokeWidth={isActive ? 2.5 : 2}
              />
            </div>
            <span
              className={cn(
                "text-[10px] font-semibold tracking-wide transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {item.label}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
