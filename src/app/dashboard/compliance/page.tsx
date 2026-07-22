"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export default function GlobalCompliancePage() {
  const { data: session } = useSession()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // New Filing state
  const [clientsList, setClientsList] = useState<any[]>([])
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [newFilingClient, setNewFilingClient] = useState("")
  const [newFilingType, setNewFilingType] = useState("")
  const [newFilingDate, setNewFilingDate] = useState("")
  const [newFilingNotes, setNewFilingNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filters state
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const fetchGlobalCompliance = async () => {
    setLoading(true)
    try {
      const queryParams = new URLSearchParams()
      if (typeFilter && typeFilter !== "all") queryParams.append("type", typeFilter)
      if (statusFilter && statusFilter !== "all") queryParams.append("status", statusFilter)
      if (startDate) queryParams.append("startDate", startDate)
      if (endDate) queryParams.append("endDate", endDate)

      const res = await fetch(`/api/compliance?${queryParams.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setItems(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableClients = async () => {
    try {
      const res = await fetch("/api/clients")
      if (res.ok) {
        const data = await res.json()
        setClientsList(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchGlobalCompliance()
  }, [typeFilter, statusFilter, startDate, endDate])

  useEffect(() => {
    fetchAvailableClients()
  }, [])

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    try {
      const updatePayload: any = { status: newStatus }
      if (newStatus === "FILED" || newStatus === "ACKNOWLEDGED") {
        updatePayload.filedDate = new Date().toISOString()
      } else {
        updatePayload.filedDate = null
      }

      const res = await fetch(`/api/compliance-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload)
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || "Status update failed")
      }

      fetchGlobalCompliance()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleCreateFiling = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFilingClient || !newFilingType || !newFilingDate) {
      alert("Please fill in Client, Category, and Due Date")
      return
    }

    setIsSubmitting(true)
    try {
      // Timezone fix: anchor to noon UTC to prevent off-by-one-day on native YYYY-MM-DD
      const dateStr = newFilingDate.includes("T") ? newFilingDate : `${newFilingDate}T12:00:00Z`
      
      const res = await fetch(`/api/clients/${newFilingClient}/compliance-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newFilingType,
          dueDate: dateStr,
          notes: newFilingNotes
        })
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || "Failed to create filing")
      }

      setIsNewModalOpen(false)
      setNewFilingClient("")
      setNewFilingType("")
      setNewFilingDate("")
      setNewFilingNotes("")
      fetchGlobalCompliance()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground/90">Compliance Tracker</h1>
          <p className="text-sm text-muted-foreground">Track filings and statutory deadlines across all clients.</p>
        </div>
        {session?.user?.role !== "DATA_ENTRY" && (
          <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
            <DialogTrigger
              render={
                <Button className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  New Filing
                </Button>
              }
            />
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create Compliance Filing</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateFiling} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Select value={newFilingClient} onValueChange={(v) => v && setNewFilingClient(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientsList.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={newFilingType} onValueChange={(v) => v && setNewFilingType(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GST">GST</SelectItem>
                      <SelectItem value="INCOME_TAX">Income Tax</SelectItem>
                      <SelectItem value="SALES_TAX_VAT">Sales Tax / VAT</SelectItem>
                      <SelectItem value="TDS">TDS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input 
                    type="date" 
                    value={newFilingDate} 
                    onChange={e => setNewFilingDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <textarea 
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Any specific filing details..."
                    value={newFilingNotes}
                    onChange={e => setNewFilingNotes(e.target.value)}
                  />
                </div>

                <div className="pt-4 flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Filing
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters bar */}
      <div className="bg-card border border-border rounded-2xl shadow-sm grid grid-cols-2 md:flex md:flex-wrap gap-3 md:gap-4 p-4 md:p-5 animate-fade-in" style={{ animationDelay: '100ms' }}>
        <div className="flex flex-col gap-1.5 flex-1">
          <Label className="text-xs text-muted-foreground">Category</Label>
          <Select value={typeFilter} onValueChange={v => setTypeFilter(v || "all")}>
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="GST">GST</SelectItem>
              <SelectItem value="INCOME_TAX">Income Tax</SelectItem>
              <SelectItem value="SALES_TAX_VAT">Sales Tax / VAT</SelectItem>
              <SelectItem value="TDS">TDS</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 flex-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v || "all")}>
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="FILED">Filed</SelectItem>
              <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 flex-1">
          <Label className="text-xs text-muted-foreground">Due From</Label>
          <Input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)} 
          />
        </div>

        <div className="flex flex-col gap-1.5 flex-1">
          <Label className="text-xs text-muted-foreground">Due To</Label>
          <Input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)} 
          />
        </div>
      </div>

      {/* Items table & mobile cards */}
      <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
        {loading ? (
          <div className="bg-card border border-border rounded-2xl shadow-sm flex items-center justify-center py-16 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading trackers...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl shadow-sm flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No filings match the filters</p>
            <p className="text-xs text-muted-foreground">Try adjusting the filters or create a new filing.</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {items.map((item) => (
                <div key={item.id} className="bg-card border border-border rounded-2xl shadow-sm p-4 flex flex-col gap-3 relative overflow-hidden hover:shadow-md transition-shadow duration-200">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground text-base">{item.client.name}</span>
                      <span className="text-xs font-semibold text-primary">{item.type}</span>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="text-xs text-muted-foreground">Due Date</span>
                      <span className="text-sm font-medium">{new Date(item.dueDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
                    <Select value={item.status} onValueChange={(v) => v && handleStatusChange(item.id, v)}>
                      <SelectTrigger className="w-[140px] h-8 text-xs font-medium">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                        {session?.user?.role !== "DATA_ENTRY" && (
                          <>
                            <SelectItem value="FILED">Filed</SelectItem>
                            <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  {item.notes && (
                    <div className="text-xs text-muted-foreground mt-1 bg-muted/20 p-2 rounded-lg">
                      {item.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Client</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Category</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Due Date</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className="transition-colors duration-150 hover:bg-muted/30 border-b border-border/50">
                      <TableCell className="font-medium text-foreground">{item.client.name}</TableCell>
                      <TableCell className="font-semibold text-muted-foreground">{item.type}</TableCell>
                      <TableCell>{new Date(item.dueDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Select value={item.status} onValueChange={(v) => v && handleStatusChange(item.id, v)}>
                          <SelectTrigger className="w-[140px] h-8 text-xs font-medium">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                            {session?.user?.role !== "DATA_ENTRY" && (
                              <>
                                <SelectItem value="FILED">Filed</SelectItem>
                                <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate" title={item.notes || ""}>
                        {item.notes || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
