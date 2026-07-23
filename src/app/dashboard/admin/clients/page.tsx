"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Search, Download, ShieldAlert, Building2, Users, UserCheck, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"

interface AssignedUser {
  id: string
  name: string
  email: string
  role: string
}

interface AdminClient {
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

function escapeCsv(field: unknown): string {
  const s = String(field ?? "")
  return `"${s.replace(/"/g, '""')}"`
}

export default function AdminClientsPage() {
  const { data: session, status: sessionStatus } = useSession()
  const [clients, setClients] = useState<AdminClient[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL")
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const role = session?.user?.role

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await fetch("/api/clients?pageSize=100", {
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
    fetchClients()
  }, [])

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
        alert(json.error || "Failed to update status")
        return
      }
      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, status: newStatus } : c))
      )
    } catch (err) {
      alert("Network error updating status")
    } finally {
      setUpdatingId(null)
    }
  }

  const handleExport = () => {
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
    const rows = filteredClients.map((c) => [
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
  }

  const filteredClients = (() => {
    const q = searchQuery.trim().toLowerCase()
    return clients.filter((c) => {
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.pan?.toLowerCase().includes(q) ?? false) ||
        (c.gstin?.toLowerCase().includes(q) ?? false)
      const matchesStatus = statusFilter === "ALL" || c.status === statusFilter
      const matchesType = typeFilter === "ALL" || c.type === typeFilter
      return matchesSearch && matchesStatus && matchesType
    })
  })()

  const stats = (() => ({
      total: clients.length,
      active: clients.filter((c) => c.status === "ACTIVE").length,
      onboarding: clients.filter((c) => c.status === "ONBOARDING").length,
      inactive: clients.filter((c) => c.status === "INACTIVE").length,
    }))()

  if (sessionStatus === "loading") {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    )
  }

  if (role !== "ADMIN" && role !== "MANAGER") {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center animate-fade-in">
        <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground mt-2">
          You do not have permission to view this page.
        </p>
      </div>
    )
  }

  const statCards = [
    { label: "Total Clients", value: stats.total, icon: Building2, accent: "text-primary" },
    { label: "Active", value: stats.active, icon: UserCheck, accent: "text-green-500" },
    { label: "Onboarding", value: stats.onboarding, icon: UserPlus, accent: "text-amber-500" },
    { label: "Inactive", value: stats.inactive, icon: Users, accent: "text-muted-foreground" },
  ]

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground/90">
            Client Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage all clients across the firm — update status, reassign staff, and export records.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={filteredClients.length === 0}
            className="h-9"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Link
            href="/dashboard/clients/new"
            className={buttonVariants({ variant: "default", size: "sm", className: "h-9" })}
          >
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, email, PAN, GSTIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-xl border border-input bg-background text-sm outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
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
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
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
        {loading ? (
          <div className="bg-card border border-border rounded-2xl shadow-sm flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : clients.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl shadow-sm flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No clients found</p>
            <p className="text-xs text-muted-foreground">
              Clients will appear here once registered.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-xs text-muted-foreground">
                Showing {filteredClients.length} of {total} client{total === 1 ? "" : "s"}
              </p>
            </div>

            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  className="bg-card border border-border rounded-2xl shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow duration-200"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-bold text-foreground text-base leading-tight truncate">
                        {client.name}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">{client.type}</span>
                    </div>
                    <Badge variant={getStatusVariant(client.status) as "default" | "secondary" | "destructive" | "success" | "warning" | "outline"} className="shrink-0">
                      {client.status}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                        Assigned To
                      </span>
                      <span className="text-sm font-medium text-foreground truncate">
                        {client.assignedTo.map((u) => u.name).join(", ") || "-"}
                      </span>
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
                      onValueChange={(val) => handleStatusChange(client.id, val)}
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
                    <Link
                      href={`/dashboard/clients/${client.id}`}
                      className={buttonVariants({ variant: "secondary", size: "sm", className: "shrink-0" })}
                    >
                      View
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
                      Created
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-sm text-muted-foreground">
                        No clients match your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClients.map((client) => (
                      <TableRow
                        key={client.id}
                        className="transition-colors duration-150 hover:bg-muted/30 border-b border-border/50"
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
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
                        <TableCell>{client.type}</TableCell>
                        <TableCell>
                          <Select
                            value={client.status}
                            onValueChange={(val) => handleStatusChange(client.id, val)}
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
                          {client.assignedTo.map((u) => u.name).join(", ") || "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(client.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/dashboard/clients/${client.id}`}
                            className={buttonVariants({
                              variant: "link",
                              className: "p-0 h-auto text-primary",
                            })}
                          >
                            View Details
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
