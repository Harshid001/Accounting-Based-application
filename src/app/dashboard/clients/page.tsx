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
          const data = await res.json()
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
        const data = await res.json()
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
      case 'ACTIVE': return 'default'
      case 'ONBOARDING': return 'secondary'
      case 'INACTIVE': return 'destructive'
      default: return 'outline'
    }
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground font-heading tracking-tight">Clients</h1>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-input bg-background/50 backdrop-blur-sm text-sm outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <Link href="/dashboard/clients/new" className={buttonVariants({ variant: "default", size: "icon", className: "h-10 w-10 shrink-0 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all bg-primary text-primary-foreground" })}>
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </Link>
        </div>
      </div>

      <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
        {clients.length === 0 ? (
          <div className="rounded-3xl glass-card text-center py-12 text-muted-foreground">
            No clients found.
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {filteredClients.map((client) => (
                <div key={client.id} className="rounded-2xl glass-card p-4 flex flex-col gap-3 relative overflow-hidden">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        {client.isPinned && <Pin className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20" />}
                        <span className="font-bold text-foreground text-base leading-tight">{client.name}</span>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{client.type}</span>
                    </div>
                    <Badge variant={getStatusVariant(client.status) as any} className="shrink-0">
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
            <div className="hidden md:block rounded-3xl glass-card overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow className="border-border/30 hover:bg-transparent">
                    <TableHead className="text-foreground font-semibold">Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>PAN</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {client.isPinned && <Pin className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20" />}
                          {client.name}
                        </div>
                      </TableCell>
                      <TableCell>{client.type}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(client.status) as any}>
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
