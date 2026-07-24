import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PayButton } from "@/components/client-portal/pay-button"

export default async function ClientInvoicesPage() {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || session.user.role !== "CLIENT") {
    redirect("/login")
  }

  const clientId = session.user.clientId
  if (!clientId) {
    return <div className="p-8 text-center text-muted-foreground">No client account associated.</div>
  }

  const invoices = await prisma.invoice.findMany({
    where: { clientId },
    include: {
      payments: true
    },
    orderBy: { issueDate: "desc" }
  })

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoices & Payments</h1>
        <p className="text-muted-foreground mt-1">View and pay your outstanding invoices securely online.</p>
      </div>

      <div className="animate-fade-in">
        {invoices.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground shadow-sm">
            No invoices found.
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {invoices.map((inv) => {
                const isPaid = inv.status === "PAID" || inv.status === "VOID"
                const amountPaid = inv.payments.reduce((sum, p) => sum + Number(p.amount), 0)
                const balance = Number(inv.total) - amountPaid

                return (
                  <div key={inv.id} className="bg-card border border-border rounded-2xl shadow-sm p-4 flex flex-col gap-3 relative overflow-hidden transition-shadow duration-200 hover:shadow-md">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground text-base">#{inv.invoiceNumber}</span>
                        <span className="text-xs text-muted-foreground">Due: {new Date(inv.dueDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-foreground">${Number(inv.total).toFixed(2)}</span>
                        <Badge variant={isPaid ? "default" : "secondary"} className="mt-1">
                          {inv.status}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/50">
                      <a href={`/api/invoices/${inv.id}/download`} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">
                        Download PDF
                      </a>
                      {!isPaid && balance > 0 && (
                        <PayButton invoiceId={inv.id} amount={balance} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => {
                    const isPaid = inv.status === "PAID" || inv.status === "VOID"
                    const amountPaid = inv.payments.reduce((sum, p) => sum + Number(p.amount), 0)
                    const balance = Number(inv.total) - amountPaid

                    return (
                      <TableRow key={inv.id} className="transition-colors duration-150 hover:bg-muted/30">
                        <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                        <TableCell>{new Date(inv.issueDate).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(inv.dueDate).toLocaleDateString()}</TableCell>
                        <TableCell>${Number(inv.total).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={isPaid ? "default" : "secondary"}>
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a href={`/api/invoices/${inv.id}/download`} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline mr-4">
                              Download PDF
                            </a>
                            {!isPaid && balance > 0 && (
                              <PayButton invoiceId={inv.id} amount={balance} />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
