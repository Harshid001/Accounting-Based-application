import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { BottomNav } from "@/components/dashboard/bottom-nav"
import AccountMenu from "@/components/dashboard/AccountMenu"
import { GestureProvider } from "@/components/dashboard/gesture-provider"
import { GlobalBackButton } from "@/components/dashboard/global-back-button"

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  // CLIENT-role users get the separate client portal, not this shell.
  if (!session) {
    redirect("/login")
  }
  if (session.user.role === "CLIENT") {
    redirect("/client-view")
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground relative selection:bg-primary/30">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border/50 bg-background z-10 sticky top-0 h-screen print:hidden">
        <div className="flex items-center gap-3 border-b border-border/50 px-6 py-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-md">
            A
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground font-heading">
            AFMS
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          <SidebarNav />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col relative w-full">
        {/* Sticky Header with Notch Support */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/50 bg-background/95 backdrop-blur-sm px-4 md:px-10 pt-[env(safe-area-inset-top)] h-[calc(73px+env(safe-area-inset-top))] print:hidden">
          <div className="flex items-center gap-3">
            {/* Custom AFMS Logo */}
            <div className="flex size-9 md:hidden items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm ring-1 ring-border">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <h2 className="text-xl font-extrabold tracking-tight text-foreground md:hidden">
              AFMS
            </h2>
            
            <h2 className="hidden md:block text-2xl font-semibold tracking-tight text-foreground/90">
              Dashboard
            </h2>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <AccountMenu />
          </div>
        </header>

        {/* Page Content: padding bottom on mobile to clear BottomNav */}
        <main className="flex-1 p-4 md:p-10 animate-fade-in pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-10 w-full max-w-full overflow-x-hidden print:p-0 print:pb-0">
          <GestureProvider>
            <GlobalBackButton />
            {children}
          </GestureProvider>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden print:hidden">
        <BottomNav />
      </div>
    </div>
  )
}

