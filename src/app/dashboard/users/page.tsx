"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, ShieldAlert, Link2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ClientInfo {
  id: string
  name: string
}

interface User {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  clientId: string | null
  client: ClientInfo | null
}

export default function UsersPage() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [clients, setClients] = useState<ClientInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const isAdmin = session?.user?.role === "ADMIN"

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users")
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      } else {
        setError("Failed to fetch users")
      }
    } catch (err) {
      setError("An error occurred while fetching users.")
    } finally {
      setLoading(false)
    }
  }

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/clients")
      if (res.ok) {
        const data = await res.json()
        setClients(data)
      }
    } catch (err) {
      // Silently fail - client linking just won't be available
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchClients()
  }, [])

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole })
      })
      
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || "Failed to update role")
        return
      }
      
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
    } catch (error) {
      alert("Network error updating role")
    }
  }

  const handleToggleActive = async (userId: string, currentIsActive: boolean) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentIsActive })
      })
      
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || "Failed to update status")
        return
      }
      
      setUsers(users.map(u => u.id === userId ? { ...u, isActive: !currentIsActive } : u))
    } catch (error) {
      alert("Network error updating status")
    }
  }

  const handleClientLink = async (userId: string, clientId: string) => {
    try {
      const newClientId = clientId === "__none__" ? null : clientId
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: newClientId })
      })
      
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || "Failed to link client")
        return
      }

      const linkedClient = newClientId ? clients.find(c => c.id === newClientId) || null : null
      setUsers(users.map(u => u.id === userId ? { ...u, clientId: newClientId, client: linkedClient } : u))
    } catch (error) {
      alert("Network error linking client")
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center animate-fade-in">
        <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground mt-2">You do not have permission to view this page.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground font-heading tracking-tight">User Management</h1>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm font-medium text-destructive animate-fade-in">
          {error}
        </div>
      )}

      <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
        {loading ? (
          <div className="rounded-3xl glass-card flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-3xl glass-card flex items-center justify-center py-12 text-muted-foreground">
            No users found.
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {users.map((user) => (
                <div key={user.id} className={cn("rounded-2xl glass-card p-4 flex flex-col gap-3 relative overflow-hidden", !user.isActive && "opacity-75 bg-muted/20")}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-foreground text-base leading-tight">{user.name || "N/A"}</span>
                      <span className="text-xs font-medium text-muted-foreground">{user.email}</span>
                    </div>
                    <Badge variant={user.isActive ? "default" : "secondary"} className="shrink-0">
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-col gap-3 pt-2 border-t border-border/50 mt-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <Select
                          value={user.role}
                          onValueChange={(val) => handleRoleChange(user.id as string, val as string)}
                        >
                          <SelectTrigger className="w-full h-9 text-xs font-medium">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ADMIN">ADMIN</SelectItem>
                            <SelectItem value="MANAGER">MANAGER</SelectItem>
                            <SelectItem value="ACCOUNTANT">ACCOUNTANT</SelectItem>
                            <SelectItem value="DATA_ENTRY">DATA ENTRY</SelectItem>
                            <SelectItem value="CLIENT">CLIENT</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        variant={user.isActive ? "destructive" : "default"} 
                        size="sm"
                        className="shrink-0 h-9"
                        onClick={() => handleToggleActive(user.id, user.isActive)}
                      >
                        {user.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>

                    {/* Client Link for CLIENT role */}
                    {user.role === "CLIENT" && (
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Select
                          value={user.clientId || "__none__"}
                          onValueChange={(val) => handleClientLink(user.id as string, val as string)}
                        >
                          <SelectTrigger className="w-full h-9 text-xs font-medium">
                            <SelectValue placeholder="Link to client..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">No client linked</SelectItem>
                            {clients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
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
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Linked Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className={!user.isActive ? "bg-muted/50" : ""}>
                      <TableCell className="font-medium">{user.name || "N/A"}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          onValueChange={(val) => handleRoleChange(user.id as string, val as string)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ADMIN">ADMIN</SelectItem>
                            <SelectItem value="MANAGER">MANAGER</SelectItem>
                            <SelectItem value="ACCOUNTANT">ACCOUNTANT</SelectItem>
                            <SelectItem value="DATA_ENTRY">DATA ENTRY</SelectItem>
                            <SelectItem value="CLIENT">CLIENT</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {user.role === "CLIENT" ? (
                          <Select
                            value={user.clientId || "__none__"}
                            onValueChange={(val) => handleClientLink(user.id as string, val as string)}
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue placeholder="Link client..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">No client</SelectItem>
                              {clients.map((client) => (
                                <SelectItem key={client.id} value={client.id}>
                                  {client.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "default" : "secondary"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant={user.isActive ? "destructive" : "default"} 
                          size="sm"
                          className="w-24"
                          onClick={() => handleToggleActive(user.id, user.isActive)}
                        >
                          {user.isActive ? "Deactivate" : "Activate"}
                        </Button>
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
