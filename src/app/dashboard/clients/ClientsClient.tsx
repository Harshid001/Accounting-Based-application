"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, Search, Download, Pin, PinOff, Trash2, Pencil, Building2, Users, UserCheck, UserPlus, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface AssignedUser {
  id: string
  name: string
  email?: string
  role?: string
}

interface Client {
  id: string
  name: string
  type: string
  status: string
  email: string | null
  phone: string | null
  pan: string | null
  gstin: string | null
  tan: string | null
  isPinned: boolean
  createdAt: string
  assignedTo: AssignedUser[]
}

type StatusFilter = "ALL" | "ACTIVE" | "ONBOARDING" | "INACTIVE"
type TypeFilter = "ALL" | "BUSINESS" | "INDIVIDUAL"

const STATUS_OPTIONS: { value: Exclude<StatusFilter, "ALL">; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "INACTIVE", label: "Inactive" },
]

function getStatusVariant(status: string) {
  switch (status) {
    case "ACTIVE":
      return "success"
    case "ONBOARDING":
      return "warning"
    case "INACTIVE":
      return "destructive"
    default:
      return "outline"
  }
}

function getTypeVariant(type: string) {
  switch (type) {
    case "BUSINESS":
      return "default"
    case "INDIVIDUAL":
      return "secondary"
    default:
      return "outline"
  }
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function escapeCsv(field: unknown): string {
  const s = String(field ?? "")
  return `"${s.replace(/"/g, '""')}"`
}

export function ClientsClient({ initialClients, initialTotal }: { initialClients: Client[], initialTotal: number }) {
  const [clients, setClients] = useState<Client[]>(initialClients || [])
  const [total, setTotal] = useState(initialTotal || 0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL")
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)

  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const fetchClients = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          pageSize: String(pageSize),
          page: String(page),
        })
        const q = searchQuery.trim()
        if (q) params.set("search", q)
        if (statusFilter !== "ALL") params.set("status", statusFilter)
        if (typeFilter !== "ALL") params.set("type", typeFilter)

        const res = await fetch(`/api/clients?${params.toString()}`, {
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        })
        if (res.ok) {
          const json = await res.json()
          const data = json.data || json
          setClients(data)
          setTotal(json.pagination?.total ?? data.length)
        } else {
          setError("Failed to fetch clients")
        }
      } catch (err) {
        setError("An error occurred while fetching clients.")
      } finally {
        setLoading(false)
      }
    }

    const debounceTimer = setTimeout(() => {
      fetchClients()
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [searchQuery, statusFilter, typeFilter, page, pageSize])

  const handleTogglePin = async (client: Client) => {
    setProcessingId(client.id)
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: !client.isPinned }),
      })
      if (res.ok) {
        setClients((prev) =>
          prev.map((c) => (c.id === client.id ? { ...c, isPinned: !c.isPinned } : c))
        )
      } else {
        const _resData = await res.json()
        const data = _resData.data || _resData
        setError(data.error || "Failed to update pin")
      }
    } catch (e) {
      setError("Failed to update pin")
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
        setClients((prev) => prev.filter((c) => c.id !== client.id))
      } else {
        const _resData = await res.json()
        const data = _resData.data || _resData
        setError(data.error || "Failed to delete client")
      }
    } catch (e) {
      setError("Failed to delete client")
    } finally {
      setProcessingId(null)
    }
  }

  const handleStatusChange = async (clientId: string, newStatus: string) => {
    setUpdatingId(clientId)
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error || "Failed to update status")
        return
      }
      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, status: newStatus } : c))
      )
    } catch (err) {
      setError("Network error updating status")
    } finally {
      setUpdatingId(null)
    }
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        pageSize: "100",
        page: "1",
      })
      const q = searchQuery.trim()
      if (q) params.set("search", q)
      if (statusFilter !== "ALL") params.set("status", statusFilter)
      if (typeFilter !== "ALL") params.set("type", typeFilter)

      const res = await fetch(`/api/clients?${params.toString()}`, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      })
      if (!res.ok) {
        setError("Failed to fetch clients for export")
        return
      }
      const json = await res.json()
      const exportClients: Client[] = json.data || json

      const headers = [
        "Name",
        "Type",
        "Status",
        "Email",
        "Phone",
        "PAN",
        "GSTIN",
        "Assigned To",
        "Created",
      ]
      const rows = exportClients.map((c) => [
        c.name,
        c.type,
        c.status,
        c.email || "",
        c.phone || "",
        c.pan || "",
        c.gstin || "",
        c.assignedTo.map((u) => u.name).join("; "),
        new Date(c.createdAt).toLocaleDateString(),
      ])
      const csv = [headers, ...rows]
        .map((r) => r.map(escapeCsv).join(","))
        .join("\n")
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `clients-${new Date().toISOString().split("T")[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError("Failed to export clients")
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const stats = (() => ({
    total: total,
    active: clients.filter((c) => c.status === "ACTIVE").length,
    onboarding: clients.filter((c) => c.status === "ONBOARDING").length,
    inactive: clients.filter((c) => c.status === "INACTIVE").length,
  }))()

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading clients...
      </div>
    )
  }

  const statCards = [
    { label: "Total Clients", value: stats.total, icon: Building2, accent: "text-primary" },
    { label: "Active (page)", value: stats.active, icon: UserCheck, accent: "text-green-500" },
    { label: "Onboarding (page)", value: stats.onboarding, icon: UserPlus, accent: "text-amber-500" },
    { label: "Inactive (page)", value: stats.inactive, icon: Users, accent: "text-muted-foreground" },
  ]

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground/90">
            Clients
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your firm&apos;s client portfolio — update status, pin key clients, and export records.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={total === 0}
            className="h-9"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Link
            href="/dashboard/clients/new"
            className={buttonVariants({ variant: "default", size: "sm", className: "h-9" })}
          >
            <Plus className="h-4 w-4 mr-2" strokeWidth={2.5} />
            New Client
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="bg-card border border-border rounded-2xl shadow-sm p-4 flex items-center gap-3"
          >
            <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
              <s.icon className={cn("h-5 w-5", s.accent)} />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-foreground leading-none">{s.value}</span>
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mt-1">
                {s.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm font-medium text-destructive animate-fade-in">
          {error}
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, email, PAN, GSTIN..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
            className="w-full h-9 pl-9 pr-4 rounded-xl border border-input bg-background text-sm outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-[160px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as TypeFilter); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-[160px] h-9">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value="BUSINESS">Business</SelectItem>
            <SelectItem value="INDIVIDUAL">Individual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="animate-fade-in">
        {clients.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl shadow-sm flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No clients yet</p>
            <p className="text-xs text-muted-foreground">Add your first client to get started.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-xs text-muted-foreground">
                Showing {clients.length} of {total} client{total === 1 ? "" : "s"}
                {totalPages > 1 && ` · Page ${page} of ${totalPages}`}
              </p>
            </div>

            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {clients.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl shadow-sm flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Search className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No clients match your filters</p>
                  <p className="text-xs text-muted-foreground">Try adjusting your search or filters.</p>
                </div>
              ) : clients.map((client) => (
                <div
                  key={client.id}
                  className="bg-card border border-border rounded-2xl shadow-sm p-4 flex flex-col gap-3 relative overflow-hidden hover:shadow-md transition-shadow duration-200"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {client.isPinned && <Pin className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20 shrink-0" />}
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs border border-border/50 shrink-0">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-bold text-foreground text-base leading-tight truncate">
                            {client.name}
                          </span>
                          <Badge variant={getTypeVariant(client.type) as "default" | "secondary" | "destructive" | "success" | "warning" | "outline"} className="w-fit">
                            {client.type}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Badge variant={getStatusVariant(client.status) as "default" | "secondary" | "destructive" | "success" | "warning" | "outline"} className="shrink-0">
                      {client.status}
                    </Badge>
                  </div>

                  {client.email && (
                    <div className="text-xs text-muted-foreground truncate">{client.email}</div>
                  )}

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
                    <div className="flex flex-col min-w-0 gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                        Assigned To
                      </span>
                      {client.assignedTo.length > 0 ? (
                        <div className="flex -space-x-2">
                          {client.assignedTo.map((u) => (
                            <div
                              key={u.id}
                              title={u.name}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-[10px] border-2 border-card ring-1 ring-border/50 shrink-0"
                            >
                              {getInitials(u.name)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm font-medium text-foreground">-</span>
                      )}
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                        PAN
                      </span>
                      <span className="text-sm font-medium text-foreground">{client.pan || "-"}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/50 flex items-center gap-2">
                    <Select
                      value={client.status}
                      onValueChange={(val) => { if (val) handleStatusChange(client.id, val) }}
                      disabled={updatingId === client.id}
                    >
                      <SelectTrigger className="w-full h-9 text-xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="pt-3 border-t border-border/50 mt-1 flex items-center justify-between gap-2">
                    <Link href={`/dashboard/clients/${client.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                      View Details
                    </Link>
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
                      <Link
                        href={`/dashboard/clients/${client.id}/edit`}
                        className={buttonVariants({ variant: "ghost", size: "icon", className: "h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10" })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
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
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Name
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Type
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      PAN
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Assigned To
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      View Details
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-sm text-muted-foreground">
                        <div className="flex flex-col items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <Search className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">No clients match your filters</p>
                            <p className="text-xs text-muted-foreground">Try adjusting your search or filters.</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : clients.map((client) => (
                    <TableRow key={client.id} className="transition-colors duration-150 hover:bg-muted/30 border-b border-border/50">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          {client.isPinned && <Pin className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20 shrink-0" />}
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs border border-border/50 shrink-0">
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-foreground">{client.name}</span>
                            {client.email && (
                              <span className="text-xs text-muted-foreground">{client.email}</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getTypeVariant(client.type) as "default" | "secondary" | "destructive" | "success" | "warning" | "outline"}>
                          {client.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={client.status}
                          onValueChange={(val) => { if (val) handleStatusChange(client.id, val) }}
                          disabled={updatingId === client.id}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{client.pan || "-"}</TableCell>
                      <TableCell>
                        {client.assignedTo.length > 0 ? (
                          <div className="flex -space-x-2">
                            {client.assignedTo.map((u) => (
                              <div
                                key={u.id}
                                title={u.name}
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-[10px] border-2 border-card ring-1 ring-border/50 shrink-0"
                              >
                                {getInitials(u.name)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Link href={`/dashboard/clients/${client.id}`} className={buttonVariants({ variant: "link", className: "p-0 h-auto text-primary" })}>
                          View Details
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
                            onClick={() => handleTogglePin(client)}
                            disabled={processingId === client.id}
                          >
                            {client.isPinned ? <PinOff className="h-4 w-4 text-amber-500" /> : <Pin className="h-4 w-4" />}
                          </Button>
                          <Link
                            href={`/dashboard/clients/${client.id}/edit`}
                            className={buttonVariants({ variant: "ghost", size: "icon", className: "h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10" })}
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 pt-2">
                <p className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="h-9"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="h-9"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
