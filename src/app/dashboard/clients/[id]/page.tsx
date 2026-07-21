"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Download, Archive, Plus, Upload, Printer, ClipboardList, Clock, Edit3 } from "lucide-react"

export default function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { data: session } = useSession()
  const resolvedParams = use(params)
  
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState<"profile" | "documents" | "compliance" | "tasks">("profile")

  // Documents state
  const [documents, setDocuments] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [docForm, setDocForm] = useState({ type: "BANK_STATEMENT" })

  // Compliance state
  const [complianceItems, setComplianceItems] = useState<any[]>([])
  const [compForm, setCompForm] = useState({ type: "GST", dueDate: "", notes: "" })

  // Tasks state
  const [tasks, setTasks] = useState<any[]>([])

  const fetchTasks = async () => {
    try {
      const res = await fetch(`/api/tasks?clientId=${resolvedParams.id}`)
      if (res.ok) {
        const data = await res.json()
        setTasks(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchClientData = async () => {
    try {
      const res = await fetch(`/api/clients/${resolvedParams.id}`)
      if (!res.ok) throw new Error("Failed to load client details")
      const data = await res.json()
      setClient(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`/api/clients/${resolvedParams.id}/documents`)
      if (res.ok) {
        const data = await res.json()
        setDocuments(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchCompliance = async () => {
    try {
      const res = await fetch(`/api/clients/${resolvedParams.id}/compliance-items`)
      if (res.ok) {
        const data = await res.json()
        setComplianceItems(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchClientData()
    fetchDocuments()
    fetchCompliance()
    fetchTasks()
  }, [resolvedParams.id])

  // --- Document Upload Logic ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const files = Array.from(e.target.files)
    setUploading(true)
    setUploadError("")

    try {
      for (const file of files) {
        const res = await fetch(`/api/clients/${resolvedParams.id}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            type: docForm.type,
          })
        })

        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || `Upload initiation failed for ${file.name}`)
        }

        const { uploadUrl } = await res.json()

        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file
        })

        if (!uploadRes.ok) {
          const errorText = await uploadRes.text()
          throw new Error(`Storage Error: ${uploadRes.status} - ${errorText}`)
        }
      }

      fetchDocuments()
    } catch (err: any) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  const handleArchiveDoc = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true })
      })
      if (res.ok) {
        fetchDocuments()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDownloadDoc = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}/download`)
      if (!res.ok) throw new Error("Download unauthorized")
      const { downloadUrl } = await res.json()
      window.open(downloadUrl, "_blank")
    } catch (err: any) {
      alert(err.message)
    }
  }

  // --- Compliance Management Logic ---
  const handleAddCompliance = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch(`/api/clients/${resolvedParams.id}/compliance-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(compForm)
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || "Failed to add compliance item")
      }
      setCompForm({ type: "GST", dueDate: "", notes: "" })
      fetchCompliance()
    } catch (err: any) {
      alert(err.message)
    }
  }

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

      fetchCompliance()
    } catch (err: any) {
      alert(err.message)
    }
  }

  if (loading) return (
    <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading profile...
    </div>
  )
  if (error) return <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
  if (!client) return <div>Client not found</div>

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'default'
      case 'ONBOARDING': return 'secondary'
      case 'INACTIVE': return 'destructive'
      case 'DONE': return 'default'
      default: return 'outline'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 print:mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{client.name}</h1>
            <Button onClick={() => router.push(`/dashboard/clients/${resolvedParams.id}/edit`)} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
              <Edit3 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-3 items-center">
            <span className="text-muted-foreground text-sm font-medium">{client.type}</span>
            <Badge variant={getStatusVariant(client.status) as any}>
              {client.status}
            </Badge>
          </div>
        </div>
        <div className="print:hidden">
          <Button onClick={() => window.print()} variant="outline" size="sm" className="w-full sm:w-auto">
            <Printer className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Tabs Control */}
      <div className="flex gap-6 border-b border-border print:hidden">
        {(["profile", "documents", "compliance", "tasks"] as const).map((tab) => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)} 
            className={`pb-3 text-sm font-medium transition-colors hover:text-primary ${
              activeTab === tab ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab 1: Profile */}
      {activeTab === "profile" && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4 text-foreground tracking-tight">Tax Identifiers</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">PAN:</span>
                <span className="font-medium text-foreground">{client.pan || "N/A"}</span>
              </div>
              {client.type === 'BUSINESS' && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">GSTIN:</span>
                    <span className="font-medium text-foreground">{client.gstin || "N/A"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TAN:</span>
                    <span className="font-medium text-foreground">{client.tan || "N/A"}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-sm mt-2 pt-3 border-t border-border">
                <span className="text-muted-foreground">Address:</span>
                <span className="font-medium text-foreground text-right max-w-[60%]">{client.address || "N/A"}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4 text-foreground tracking-tight">Assigned Staff</h2>
              {client.assignedTo?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No staff assigned.</p>
              ) : (
                <ul className="space-y-2">
                  {client.assignedTo?.map((u: any) => (
                    <li key={u.id} className="flex justify-between text-sm">
                      <span className="font-medium">{u.name}</span>
                      <span className="text-muted-foreground">{u.role}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4 text-foreground tracking-tight">Active Services</h2>
              {client.services?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active services.</p>
              ) : (
                <ul className="space-y-2">
                  {client.services?.map((sub: any) => (
                    <li key={sub.id} className="text-sm font-medium">
                      {sub.service.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Documents */}
      {activeTab === "documents" && (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Upload Form */}
          <div className="md:col-span-1 rounded-xl border bg-card text-card-foreground shadow-sm p-6 h-fit">
            <h2 className="text-lg font-semibold mb-4 tracking-tight">Upload Document</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Document Category</Label>
                <Select value={docForm.type} onValueChange={v => v && setDocForm({ type: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PURCHASE_INVOICE">Purchase Invoice</SelectItem>
                    <SelectItem value="SALES_INVOICE">Sales Invoice</SelectItem>
                    <SelectItem value="BANK_STATEMENT">Bank Statement</SelectItem>
                    <SelectItem value="TAX_DOCUMENT">Tax Document</SelectItem>
                    <SelectItem value="INCOME_PROOF">Income Proof</SelectItem>
                    <SelectItem value="EXPENSE_DOCUMENT">Expense Document</SelectItem>
                    <SelectItem value="AUDIT_DOCUMENT">Audit Document</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="pt-2">
                <Label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-muted-foreground/25 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                  <span className="font-medium text-sm text-foreground">
                    {uploading ? "Uploading..." : "Select & Upload Files"}
                  </span>
                  <input 
                    type="file" 
                    multiple
                    disabled={uploading} 
                    onChange={handleFileUpload} 
                    className="hidden"
                    accept=".pdf,image/*,.csv,.xls,.xlsx" 
                  />
                </Label>
                {uploadError && (
                  <div className="text-sm text-destructive mt-2 text-center font-medium bg-destructive/10 p-2 rounded-md">{uploadError}</div>
                )}
                <span className="text-xs text-muted-foreground mt-2 block text-center">Max 10MB. PDF, images, Excel, CSV supported.</span>
              </div>
            </div>
          </div>

          {/* Document list */}
          <div className="md:col-span-2 rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-semibold tracking-tight">Documents</h2>
            </div>
            {documents.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No documents uploaded yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc: any) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        <div className="truncate max-w-[150px] sm:max-w-[250px] md:max-w-[300px]" title={doc.fileName}>
                          {doc.fileName}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{doc.type}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleDownloadDoc(doc.id)} className="h-8 w-8 text-primary">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleArchiveDoc(doc.id)} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Archive className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Compliance */}
      {activeTab === "compliance" && (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Add Form */}
          {session?.user?.role !== "DATA_ENTRY" && (
            <div className="md:col-span-1 rounded-xl border bg-card text-card-foreground shadow-sm p-6 h-fit">
              <h2 className="text-lg font-semibold mb-4 tracking-tight">Add Tax/Compliance Item</h2>
              <form onSubmit={handleAddCompliance} className="space-y-4">
                <div className="space-y-2">
                  <Label>Filing Category</Label>
                  <Select value={compForm.type} onValueChange={v => v && setCompForm({ ...compForm, type: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Category" />
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
                    required 
                    type="date" 
                    value={compForm.dueDate} 
                    onChange={e => setCompForm({ ...compForm, dueDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input 
                    type="text" 
                    value={compForm.notes} 
                    onChange={e => setCompForm({ ...compForm, notes: e.target.value })}
                  />
                </div>

                <Button type="submit" className="w-full">
                  Add Item
                </Button>
              </form>
            </div>
          )}

          {/* Compliance List */}
          <div className="md:col-span-2 rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-semibold tracking-tight">Filing Trackers</h2>
            </div>
            {complianceItems.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No compliance items added yet.</div>
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
                  {complianceItems.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-semibold">{item.type}</TableCell>
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
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Tasks */}
      {activeTab === "tasks" && (
        <div className="rounded-3xl glass-card border border-border/50 shadow-sm overflow-hidden animate-slide-up">
          <div className="flex justify-between items-center px-8 py-6 border-b border-border/50 bg-background/30 backdrop-blur-md">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">Client Tasks</h2>
              <p className="text-sm text-muted-foreground font-medium mt-1">Manage ongoing work for this client</p>
            </div>
            <Button className="rounded-xl shadow-md hover:shadow-lg transition-all" size="sm" onClick={() => router.push('/dashboard/tasks/new')}>
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </div>
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-card/20">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <ClipboardList className="h-8 w-8 text-primary opacity-80" />
              </div>
              <h3 className="text-lg font-bold text-foreground">No active tasks</h3>
              <p className="text-sm text-muted-foreground font-medium mt-1 mb-6">This client is currently all caught up!</p>
              <Button variant="outline" className="rounded-xl border-dashed border-2" onClick={() => router.push('/dashboard/tasks/new')}>
                <Plus className="mr-2 h-4 w-4" /> Create their first task
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/30 bg-card/20">
              {tasks.map((task: any) => (
                <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 gap-4 hover:bg-muted/30 transition-colors group">
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 rounded-2xl p-3 bg-background shadow-sm border border-border/50 text-primary group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <h4 className="font-bold text-foreground text-base tracking-tight">{task.title}</h4>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                        <span className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded-full bg-gradient-to-tr from-secondary to-muted text-secondary-foreground flex items-center justify-center text-[10px] font-black shadow-inner ring-1 ring-border">
                            {(task.assignedTo?.name || task.assignedTo?.email)?.charAt(0).toUpperCase() || "?"}
                          </div>
                          {task.assignedTo?.name || task.assignedTo?.email || "Unassigned"}
                        </span>
                        {task.dueDate && (
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-primary/70" />
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center sm:justify-end">
                    <Badge variant={getStatusVariant(task.status) as any} className="shadow-sm px-3 py-1 text-xs">
                      {task.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
