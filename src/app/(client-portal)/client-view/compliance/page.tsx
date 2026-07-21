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

  const clientId = (session.user as any).clientId
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

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
        {complianceItems.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            No compliance items found.
          </div>
        ) : (
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
                let badgeVariant: any = "outline"
                if (item.status === "FILED" || item.status === "ACKNOWLEDGED") badgeVariant = "default"
                if (item.status === "PENDING") badgeVariant = "destructive"
                if (item.status === "IN_PROGRESS") badgeVariant = "secondary"

                return (
                  <TableRow key={item.id}>
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
        )}
      </div>
    </div>
  )
}
