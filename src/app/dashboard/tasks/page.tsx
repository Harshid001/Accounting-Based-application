"use client"

/**
 * Staff Tasks dashboard.
 *
 * Data contract assumed against the Sprint 4 API:
 *   GET   /api/tasks              -> Task[]
 *   PATCH /api/tasks/[id]         -> { status? } for assigned staff,
 *                                     { status?, assignedToId? } for Admin/Manager
 *   POST  /api/tasks              -> { title, clientId, assignedToId, dueDate? }
 *   GET   /api/clients            -> { id, name }[]        (Create dialog)
 *   GET   /api/users?role=STAFF   -> { id, name }[]         (assignee pickers)
 *
 * Adjust these calls if your actual route shapes differ — the server
 * remains the source of truth for every one of these actions; this file
 * only decides what to show, never what to allow.
 */

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Users, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  canCreateTask,
  canReassignTask,
  isStaffLeadership,
  type Role,
} from "@/lib/permissions"

type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "REVIEW" | "DONE"

interface Task {
  id: string
  title: string
  status: TaskStatus
  client: { id: string; name: string } | null
  assignedTo: { id: string; name: string } | null
  dueDate: string | null
}

interface Person {
  id: string
  name: string
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  REVIEW: "Review",
  DONE: "Done",
}

const STATUS_STYLE: Record<TaskStatus, string> = {
  NOT_STARTED: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  IN_PROGRESS: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  REVIEW: "bg-purple-100 text-purple-800 hover:bg-purple-100",
  DONE: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
}

export function TaskDashboard() {
  const { data: session } = useSession()
  const role = session?.user?.role as Role | undefined
  const userId = session?.user?.id as string | undefined

  const [tasks, setTasks] = useState<Task[]>([])
  const [clients, setClients] = useState<Person[]>([])
  const [staff, setStaff] = useState<Person[]>([])
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [reassignTaskId, setReassignTaskId] = useState<string | null>(null)

  const loadTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/tasks")
      if (!res.ok) throw new Error()
      setTasks(await res.json())
    } catch {
      setError("Couldn't load tasks. Try refreshing.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTasks()
    if (role && canCreateTask(role)) {
      fetch("/api/clients")
        .then((r) => (r.ok ? r.json() : []))
        .then(setClients)
      fetch("/api/users?role=STAFF")
        .then((r) => (r.ok ? r.json() : []))
        .then(setStaff)
    }
  }, [loadTasks, role])

  async function updateStatus(taskId: string, status: TaskStatus) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    loadTasks()
  }

  async function reassign(taskId: string, assignedToId: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToId }),
    })
    setReassignTaskId(null)
    loadTasks()
  }

  async function createTask(form: FormData) {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        clientId: form.get("clientId"),
        assignedToId: form.get("assignedToId"),
        dueDate: form.get("dueDate") || null,
      }),
    })
    setCreateOpen(false)
    loadTasks()
  }

  const visibleTasks =
    statusFilter === "ALL" ? tasks : tasks.filter((t) => t.status === statusFilter)

  return (
    <div className="space-y-6 md:space-y-8 animate-slide-up">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground font-heading tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground font-medium">
            {role && isStaffLeadership(role)
              ? "Every task across your assigned clients."
              : "Tasks assigned to you."}
          </p>
        </div>

        {role && canCreateTask(role) && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger
              render={
                <Button size="icon" className="h-10 w-10 shrink-0 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all bg-primary text-primary-foreground">
                  <Plus className="h-5 w-5" strokeWidth={2.5} />
                </Button>
              }
            />
            <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create a task</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      createTask(new FormData(e.currentTarget))
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="title">Title</Label>
                      <Input id="title" name="title" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="clientId">Client</Label>
                      <select
                        id="clientId"
                        name="clientId"
                        required
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                      >
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="assignedToId">Assign to</Label>
                      <select
                        id="assignedToId"
                        name="assignedToId"
                        required
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                      >
                        {staff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="dueDate">Due date (optional)</Label>
                      <Input id="dueDate" name="dueDate" type="date" />
                    </div>
                    <DialogFooter>
                      <Button type="submit">Create task</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
      </div>

      <div className="flex flex-wrap gap-2 animate-fade-in overflow-x-auto pb-2 scrollbar-hide" style={{ animationDelay: '100ms' }}>
        {(["ALL", "NOT_STARTED", "REVIEW", "DONE"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => setStatusFilter(s)}
            className={statusFilter !== s ? "bg-card/50 backdrop-blur-sm border-border/50" : "shadow-md shadow-primary/20"}
          >
            {s === "ALL" ? "All" : STATUS_LABEL[s]}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading tasks…
        </div>
      ) : error ? (
        <div className="flex flex-col items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={loadTasks}>
            Retry
          </Button>
        </div>
      ) : visibleTasks.length === 0 ? (
        <div className="rounded-3xl glass-card px-4 py-16 text-center text-sm font-medium text-muted-foreground animate-fade-in">
          No tasks match this filter.
        </div>
      ) : (
        <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          {/* Mobile Cards */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {visibleTasks.map((task) => {
              const canEditStatus = !!role && (isStaffLeadership(role) || task.assignedTo?.id === userId)
              
              return (
                <div key={task.id} className="rounded-2xl glass-card p-4 flex flex-col gap-3 relative overflow-hidden">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-foreground text-base leading-tight">{task.title}</span>
                      <span className="text-xs font-medium text-muted-foreground">{task.client?.name ?? "—"}</span>
                    </div>
                    {role && canReassignTask(role) && (
                      <Dialog
                        open={reassignTaskId === task.id}
                        onOpenChange={(open) => setReassignTaskId(open ? task.id : null)}
                      >
                        <DialogTrigger
                          render={
                            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0">
                              <Users className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Reassign &ldquo;{task.title}&rdquo;</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-1.5">
                            <Label htmlFor={`reassign-mobile-${task.id}`}>New assignee</Label>
                            <select
                              key={task.id}
                              id={`reassign-mobile-${task.id}`}
                              value={task.assignedTo?.id}
                              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                              onChange={(e) => reassign(task.id, e.target.value)}
                            >
                              {staff.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Assigned To</span>
                      <span className="text-sm font-medium text-foreground">{task.assignedTo?.name ?? "Unassigned"}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Due</span>
                      <span className="text-sm font-medium text-foreground">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    {canEditStatus ? (
                      <Select
                        value={task.status}
                        onValueChange={(v) => updateStatus(task.id, v as TaskStatus)}
                      >
                        <SelectTrigger
                          className={cn(
                            "h-8 w-full border-none text-xs font-medium",
                            STATUS_STYLE[task.status]
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(["NOT_STARTED", "IN_PROGRESS", "REVIEW", "DONE"] as const).map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={cn("w-full justify-center py-1.5", STATUS_STYLE[task.status])}>
                        {STATUS_LABEL[task.status]}
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block rounded-3xl glass-card overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="text-foreground font-semibold">Task</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Assigned to</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  {role && canReassignTask(role) && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTasks.map((task) => {
                  const canEditStatus =
                    !!role && (isStaffLeadership(role) || task.assignedTo?.id === userId)

                  return (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium text-slate-900">
                        {task.title}
                      </TableCell>
                      <TableCell className="text-slate-600">{task.client?.name ?? "—"}</TableCell>
                      <TableCell className="text-slate-600">
                        {task.assignedTo?.name ?? "Unassigned"}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        {canEditStatus ? (
                          <Select
                            value={task.status}
                            onValueChange={(v) => updateStatus(task.id, v as TaskStatus)}
                          >
                            <SelectTrigger
                              className={cn(
                                "h-8 w-[140px] border-none text-xs font-medium",
                                STATUS_STYLE[task.status]
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(["NOT_STARTED", "IN_PROGRESS", "REVIEW", "DONE"] as const).map((s) => (
                                <SelectItem key={s} value={s}>
                                  {STATUS_LABEL[s]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={STATUS_STYLE[task.status]}>
                            {STATUS_LABEL[task.status]}
                          </Badge>
                        )}
                      </TableCell>
                      {role && canReassignTask(role) && (
                        <TableCell>
                          <Dialog
                            open={reassignTaskId === task.id}
                            onOpenChange={(open) => setReassignTaskId(open ? task.id : null)}
                          >
                            <DialogTrigger
                              render={
                                <Button size="icon" variant="ghost" className="h-8 w-8">
                                  <Users className="h-4 w-4" />
                                </Button>
                              }
                            />
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Reassign &ldquo;{task.title}&rdquo;</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-1.5">
                                <Label htmlFor={`reassign-${task.id}`}>New assignee</Label>
                                <select
                                  key={task.id}
                                  id={`reassign-${task.id}`}
                                  value={task.assignedTo?.id}
                                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                                  onChange={(e) => reassign(task.id, e.target.value)}
                                >
                                  {staff.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TasksPage() {
  return <TaskDashboard />
}
