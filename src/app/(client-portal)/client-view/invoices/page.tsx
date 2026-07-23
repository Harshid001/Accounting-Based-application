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

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
        {invoices.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            No invoices found.
          </div>
        ) : (
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
                // Assuming all payments are successful payments for this invoice
                const amountPaid = inv.payments.reduce((sum, p) => sum + Number(p.amount), 0)
                const balance = Number(inv.total) - amountPaid

                return (
                  <TableRow key={inv.id}>
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
                        {/* We will wire PDF download later */}
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
        )}
      </div>
    </div>
  )
}
