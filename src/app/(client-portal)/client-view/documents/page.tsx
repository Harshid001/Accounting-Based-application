"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Upload, Loader2, Archive } from "lucide-react"

interface ClientDocument {
  id: string
  fileName: string
  type: string
}

export default function ClientDocumentsPage() {
  const { data: session } = useSession()
  const clientId = session?.user?.clientId

  const [documents, setDocuments] = useState<ClientDocument[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [docForm, setDocForm] = useState({ type: "BANK_STATEMENT" })

  const fetchDocumentsRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    const doFetch = async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/documents`)
        if (res.ok) {
          const _resData = await res.json()
          const data = _resData.data || _resData
          if (!cancelled) setDocuments(data)
        }
      } catch (err) {
        console.error(err)
      }
    }
    fetchDocumentsRef.current = doFetch
    doFetch()
    return () => { cancelled = true }
  }, [clientId])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const files = Array.from(e.target.files)
    setUploading(true)
    setUploadError("")

    try {
      for (const file of files) {
        const res = await fetch(`/api/clients/${clientId}/documents`, {
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

      fetchDocumentsRef.current()
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  const handleDownloadDoc = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}/download`)
      if (!res.ok) throw new Error("Download unauthorized")
      const { downloadUrl } = await res.json()
      window.open(downloadUrl, "_blank")
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err))
    }
  }

  const handleArchiveDoc = async (docId: string) => {
    if (!confirm("Are you sure you want to archive this document?")) return
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true })
      })
      if (res.ok) fetchDocumentsRef.current()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground mt-1">Upload and manage your secure documents.</p>
      </div>

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
        <div className="md:col-span-2">
          {documents.length === 0 ? (
            <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground shadow-sm">
              No documents uploaded yet.
            </div>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {documents.map((doc) => (
                  <div key={doc.id} className="bg-card border border-border rounded-2xl shadow-sm p-4 flex flex-col gap-3 relative overflow-hidden transition-shadow duration-200 hover:shadow-md">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-foreground text-base truncate" title={doc.fileName}>{doc.fileName}</span>
                      <span className="text-xs font-semibold text-primary">{doc.type}</span>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
                      <Button variant="outline" size="sm" onClick={() => handleDownloadDoc(doc.id)} className="h-8">
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Download
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleArchiveDoc(doc.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0">
                        <Archive className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => (
                      <TableRow key={doc.id} className="transition-colors duration-150 hover:bg-muted/30">
                        <TableCell className="font-medium">
                          <div className="truncate max-w-[200px]" title={doc.fileName}>
                            {doc.fileName}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{doc.type}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleDownloadDoc(doc.id)} className="h-8 w-8 text-primary">
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleArchiveDoc(doc.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                              <Archive className="h-4 w-4" />
                            </Button>
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
    </div>
  )
}
