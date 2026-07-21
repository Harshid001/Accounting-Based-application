import Link from "next/link"
import { ShieldAlert } from "lucide-react"

export default function PendingApprovalPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 p-4 animate-fade-in">
      <div className="w-full max-w-md glass-card rounded-2xl p-8 animate-slide-up text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <ShieldAlert className="h-8 w-8 text-amber-600 dark:text-amber-500" />
        </div>
        <h1 className="mb-3 text-2xl font-bold tracking-tight text-foreground">Account Pending Approval</h1>
        <p className="mb-8 text-sm font-medium leading-relaxed text-muted-foreground">
          Your account has been securely created, but it requires administrator approval before you can access the system. We will notify you once your access has been granted.
        </p>
        
        <Link 
          href="/login"
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground hover-lift transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Return to Login
        </Link>
      </div>
    </div>
  )
}
