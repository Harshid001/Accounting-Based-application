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
  { href: "/client-view", label: "Overview", icon: LayoutDashboard },
  { href: "/client-view/invoices", label: "Invoices & Payments", icon: CreditCard },
  { href: "/client-view/documents", label: "Documents", icon: FileText },
  { href: "/client-view/compliance", label: "Compliance", icon: ShieldCheck },
  { href: "/client-view/comments", label: "Messages", icon: MessageSquare },
]

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: any
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300 active:scale-95",
        active
          ? "bg-primary/10 text-primary shadow-sm"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground hover:shadow-sm"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-1/2 w-1 -translate-y-1/2 rounded-r-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
      )}
      
      <Icon 
        className={cn(
          "h-5 w-5 transition-transform duration-300",
          active ? "scale-110" : "group-hover:scale-110 group-hover:text-primary"
        )} 
        strokeWidth={active ? 2.5 : 2} 
      />
      
      <span className="tracking-wide">{label}</span>
    </Link>
  )
}

export function ClientSidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-2 p-4">
      <div className="mb-4 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Client Portal
      </div>
      
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.href} {...item} active={pathname === item.href} />
      ))}
    </nav>
  )
}
