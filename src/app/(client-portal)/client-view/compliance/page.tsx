import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default async function ClientCompliancePage() {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || session.user.role !== "CLIENT") {
    redirect("/login")
  }

  const clientId = session.user.clientId
  if (!clientId) {
    return <div className="p-8 text-center text-muted-foreground">No client account associated.</div>
  }

  const complianceItems = await prisma.complianceItem.findMany({
    where: { clientId },
    orderBy: { dueDate: "asc" }
  })

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compliance Tracking</h1>
        <p className="text-muted-foreground mt-1">Review the status of your tax and compliance filings.</p>
      </div>

      <div className="animate-fade-in">
        {complianceItems.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground shadow-sm">
            No compliance items found.
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {complianceItems.map((item) => {
                let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "outline"
                if (item.status === "FILED" || item.status === "ACKNOWLEDGED") badgeVariant = "default"
                if (item.status === "PENDING") badgeVariant = "destructive"
                if (item.status === "IN_PROGRESS") badgeVariant = "secondary"

                return (
                  <div key={item.id} className="bg-card border border-border rounded-2xl shadow-sm p-4 flex flex-col gap-3 relative overflow-hidden transition-shadow duration-200 hover:shadow-md">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground text-base">{item.type}</span>
                        <span className="text-xs text-muted-foreground">Due: {new Date(item.dueDate).toLocaleDateString()}</span>
                      </div>
                      <Badge variant={badgeVariant} className="shrink-0">
                        {item.status}
                      </Badge>
                    </div>
                    {item.notes && (
                      <div className="text-xs text-muted-foreground mt-1 bg-muted/20 p-2 rounded-lg">
                        {item.notes}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {complianceItems.map((item) => {
                    let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "outline"
                    if (item.status === "FILED" || item.status === "ACKNOWLEDGED") badgeVariant = "default"
                    if (item.status === "PENDING") badgeVariant = "destructive"
                    if (item.status === "IN_PROGRESS") badgeVariant = "secondary"

                    return (
                      <TableRow key={item.id} className="transition-colors duration-150 hover:bg-muted/30 border-b border-border/50">
                        <TableCell className="font-semibold">{item.type}</TableCell>
                        <TableCell>{new Date(item.dueDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant={badgeVariant}>
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate" title={item.notes || ""}>
                          {item.notes || "-"}
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
