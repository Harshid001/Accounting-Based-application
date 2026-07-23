import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { CreditCard, ShieldCheck, FileText, CheckCircle } from "lucide-react"

export default async function ClientPortalOverview() {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || session.user.role !== "CLIENT") {
    redirect("/login")
  }

  const clientId = session.user.clientId
  if (!clientId) {
    return <div className="p-8 text-center text-muted-foreground">No client account associated.</div>
  }

  // Fetch some summary stats
  const invoices = await prisma.invoice.findMany({
    where: { clientId, status: { notIn: ["PAID", "VOID"] } }
  })
  
  const complianceItems = await prisma.complianceItem.findMany({
    where: { clientId, status: { in: ["PENDING", "IN_PROGRESS"] } }
  })

  const recentDocs = await prisma.document.count({
    where: { clientId, archived: false }
  })

  const outstandingTotal = invoices.reduce((sum, inv) => sum + Number(inv.total), 0)

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Welcome, {session.user.name || "Client"}</h1>
        <p className="text-muted-foreground mt-2">Here is a quick overview of your account.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Unpaid Invoices */}
        <div className="rounded-2xl border bg-card text-card-foreground shadow-sm p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <CreditCard className="w-16 h-16" />
          </div>
          <h3 className="font-semibold text-lg">Outstanding Balance</h3>
          <p className="text-3xl font-bold mt-2">${outstandingTotal.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground mt-1">{invoices.length} unpaid invoices</p>
        </div>

        {/* Pending Compliance */}
        <div className="rounded-2xl border bg-card text-card-foreground shadow-sm p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <ShieldCheck className="w-16 h-16" />
          </div>
          <h3 className="font-semibold text-lg">Action Needed</h3>
          <p className="text-3xl font-bold mt-2">{complianceItems.length}</p>
          <p className="text-sm text-muted-foreground mt-1">Pending tax/compliance items</p>
        </div>

        {/* Documents */}
        <div className="rounded-2xl border bg-card text-card-foreground shadow-sm p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <FileText className="w-16 h-16" />
          </div>
          <h3 className="font-semibold text-lg">Documents</h3>
          <p className="text-3xl font-bold mt-2">{recentDocs}</p>
          <p className="text-sm text-muted-foreground mt-1">Active files</p>
        </div>
      </div>
      
      {outstandingTotal === 0 && complianceItems.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border bg-primary/5">
          <CheckCircle className="w-12 h-12 text-primary mb-4" />
          <h3 className="text-xl font-bold">You&apos;re all caught up!</h3>
          <p className="text-muted-foreground mt-2">No pending invoices or compliance actions needed.</p>
        </div>
      )}
    </div>
  )
}
