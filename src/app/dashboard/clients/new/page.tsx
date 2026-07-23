"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"

export default function NewClientPage() {
  const router = useRouter()
  const [users, setUsers] = useState<{id: string, name: string}[]>([])
  const [formData, setFormData] = useState({
    name: "",
    type: "BUSINESS",
    pan: "",
    gstin: "",
    tan: "",
    address: "",
    status: "ONBOARDING",
    assignedToIds: [] as string[]
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch("/api/users")
      .then(res => res.json())
      .then(data => setUsers(data.data))
      .catch(err => console.error(err))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })

      if (!res.ok) {
        const _resData = await res.json()
          const data = _resData.data || _resData
        throw new Error(data.error || "Failed to create client")
      }

      router.push("/dashboard/clients")
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleStaffToggle = (userId: string) => {
    setFormData(prev => {
      const isSelected = prev.assignedToIds.includes(userId)
      if (isSelected) {
        return { ...prev, assignedToIds: prev.assignedToIds.filter(id => id !== userId) }
      } else {
        return { ...prev, assignedToIds: [...prev.assignedToIds, userId] }
      }
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground tracking-tight">Register New Client</h1>
      
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>Client Name</Label>
            <Input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
            <div className="space-y-2 flex-1">
              <Label>Client Type</Label>
              <Select value={formData.type} onValueChange={v => setFormData({...formData, type: v as string})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUSINESS">Business</SelectItem>
                  <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2 flex-1">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v as string})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ONBOARDING">Onboarding</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>PAN Number</Label>
            <Input type="text" value={formData.pan} onChange={e => setFormData({...formData, pan: e.target.value})} />
          </div>

          {formData.type === "BUSINESS" && (
            <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
              <div className="space-y-2 flex-1">
                <Label>GSTIN</Label>
                <Input type="text" value={formData.gstin} onChange={e => setFormData({...formData, gstin: e.target.value})} />
              </div>
              <div className="space-y-2 flex-1">
                <Label>TAN</Label>
                <Input type="text" value={formData.tan} onChange={e => setFormData({...formData, tan: e.target.value})} />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Address</Label>
            <Input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
          </div>

          <div className="space-y-3 pt-2">
            <Label>Assign Staff Members</Label>
            <div className="flex flex-col gap-2">
              {users.map(user => (
                <label key={user.id} className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  <input 
                    type="checkbox" 
                    checked={formData.assignedToIds.includes(user.id)}
                    onChange={() => handleStaffToggle(user.id)}
                    className="h-4 w-4 rounded border-input bg-transparent text-primary focus:ring-primary/50"
                  />
                  {user.name}
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4">
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Creating..." : "Register Client"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
