"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Plus, Search, Pin, PinOff, Trash2 } from "lucide-react"

interface Client {
  id: string
  name: string
  type: string
  status: string
  pan: string | null
  isPinned: boolean
  assignedTo: { id: string; name: string }[]
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await fetch("/api/clients", {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        })
        if (res.ok) {
          const _resData = await res.json()
          const data = _resData.data || _resData
          setClients(data)
        }
      } catch (err) {
        console.error("Failed to fetch clients", err)
      } finally {
        setLoading(false)
      }
    }
    fetchClients()
  }, [])

  const handleTogglePin = async (client: Client) => {
    setProcessingId(client.id)
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: !client.isPinned })
      })
      if (res.ok) {
        setClients(clients.map(c => c.id === client.id ? { ...c, isPinned: !c.isPinned } : c))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setProcessingId(null)
    }
  }

  const handleDelete = async (client: Client) => {
    if (!window.confirm(`Are you sure you want to delete ${client.name}?`)) return
    setProcessingId(client.id)
    try {
      const res = await fetch(`/api/clients/${client.id}`, { method: "DELETE" })
      if (res.ok) {
        setClients(clients.filter(c => c.id !== client.id))
      } else {
        const _resData = await res.json()
          const data = _resData.data || _resData
        alert(data.error || "Failed to delete client")
      }
    } catch (e) {
      console.error(e)
      alert("Failed to delete client")
    } finally {
      setProcessingId(null)
    }
  }

  const filteredClients = clients
    .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.pan && c.pan.toLowerCase().includes(searchQuery.toLowerCase())))
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return 0
    })

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading clients...
      </div>
    )
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'success'
      case 'ONBOARDING': return 'warning'
      case 'INACTIVE': return 'destructive'
      default: return 'outline'
    }
  }

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground/90">Clients</h1>
          <p className="text-sm text-muted-foreground">Manage your firm&apos;s client portfolio.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-xl border border-input bg-background text-sm outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <Link href="/dashboard/clients/new" className={buttonVariants({ variant: "default", size: "icon", className: "h-9 w-9 shrink-0 rounded-xl" })}>
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </Link>
        </div>
      </div>

      <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
        {clients.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl shadow-sm flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No clients yet</p>
            <p className="text-xs text-muted-foreground">Add your first client to get started.</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {filteredClients.map((client) => (
                <div key={client.id} className="bg-card border border-border rounded-2xl shadow-sm p-4 flex flex-col gap-3 relative overflow-hidden hover:shadow-md transition-shadow duration-200">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        {client.isPinned && <Pin className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20" />}
                        <span className="font-bold text-foreground text-base leading-tight">{client.name}</span>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{client.type}</span>
                    </div>
                    <Badge variant={getStatusVariant(client.status) as "default" | "secondary" | "destructive" | "success" | "warning" | "outline"} className="shrink-0">
                      {client.status}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50 mt-1">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Assigned To</span>
                      <span className="text-sm font-medium text-foreground">{client.assignedTo.map(u => u.name).join(", ") || "-"}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">PAN</span>
                      <span className="text-sm font-medium text-foreground">{client.pan || "-"}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/50 mt-1 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
                        onClick={() => handleTogglePin(client)}
                        disabled={processingId === client.id}
                      >
                        {client.isPinned ? <PinOff className="h-4 w-4 text-amber-500" /> : <Pin className="h-4 w-4" />}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(client)}
                        disabled={processingId === client.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Link href={`/dashboard/clients/${client.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">PAN</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Assigned To</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-sm text-muted-foreground">
                        No clients match your search.
                      </TableCell>
                    </TableRow>
                  ) : filteredClients.map((client) => (
                    <TableRow key={client.id} className="transition-colors duration-150 hover:bg-muted/30 border-b border-border/50">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {client.isPinned && <Pin className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20" />}
                          {client.name}
                        </div>
                      </TableCell>
                      <TableCell>{client.type}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(client.status) as "default" | "secondary" | "destructive" | "success" | "warning" | "outline"}>
                          {client.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{client.pan || "-"}</TableCell>
                      <TableCell>
                        {client.assignedTo.map(u => u.name).join(", ") || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
                            onClick={() => handleTogglePin(client)}
                            disabled={processingId === client.id}
                          >
                            {client.isPinned ? <PinOff className="h-4 w-4 text-amber-500" /> : <Pin className="h-4 w-4" />}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(client)}
                            disabled={processingId === client.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Link href={`/dashboard/clients/${client.id}`} className={buttonVariants({ variant: "link", className: "p-0 h-auto text-primary ml-2" })}>
                            View Details
                          </Link>
                        </div>
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
