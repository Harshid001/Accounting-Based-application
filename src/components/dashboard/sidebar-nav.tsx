"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  LayoutDashboard,
  CheckSquare,
  Building2,
  FileText,
  ShieldCheck,
  UserCog,
  Briefcase,
} from "lucide-react"
import { canManageUsers, isStaffLeadership, type Role } from "@/lib/permissions"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/dashboard/clients", label: "Clients", icon: Building2 },
  { href: "/dashboard/compliance", label: "Compliance", icon: ShieldCheck },
]

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: typeof LayoutDashboard
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
      {/* Active state vertical indicator */}
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

export function SidebarNav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = session?.user?.role as Role | undefined

  return (
    <nav className="flex flex-col gap-2 p-4">
      <div className="mb-4 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Menu
      </div>
      
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.href} {...item} active={pathname === item.href} />
      ))}

      {role && isStaffLeadership(role) && (
        <>
          <div className="my-4 border-t border-border/50" />
          <div className="mb-4 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Admin
          </div>
          {canManageUsers(role) && (
            <NavLink
              href="/dashboard/users"
              label="Users"
              icon={UserCog}
              active={pathname === "/dashboard/users"}
            />
          )}
          <NavLink
            href="/dashboard/admin/clients"
            label="Clients"
            icon={Briefcase}
            active={pathname === "/dashboard/admin/clients"}
          />
        </>
      )}
    </nav>
  )
}
