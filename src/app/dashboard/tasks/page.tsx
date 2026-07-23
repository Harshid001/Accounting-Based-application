"use client";

/**
 * Staff Tasks dashboard.
 *
 * Data contract:
 *   GET   /api/tasks              -> Task[]
 *   PATCH /api/tasks/[id]         -> { status? } for assigned staff,
 *                                     { status?, assignedToId? } for Admin/Manager
 *   POST  /api/tasks              -> { title, clientId, assignedToId, dueDate? }
 *   GET   /api/clients            -> { id, name }[]        (Create dialog)
 *   GET   /api/users?role=STAFF   -> { id, name }[]         (assignee pickers)
 */

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  canCreateTask,
  canReassignTask,
  isStaffLeadership,
  type Role,
} from "@/lib/permissions";
import { TaskRow } from "@/components/dashboard/TaskRow";
import { TaskCard } from "@/components/dashboard/TaskCard";

type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "REVIEW" | "DONE";

interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  client: { id: string; name: string } | null;
  assignedTo: { id: string; name: string } | null;
  dueDate: string | null;
}

interface Person {
  id: string;
  name: string;
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  REVIEW: "Review",
  DONE: "Done",
};

const STATUS_STYLE: Record<TaskStatus, string> = {
  NOT_STARTED: "bg-muted/50 text-foreground border-border/60",
  IN_PROGRESS: "bg-muted/50 text-foreground border-border/60",
  REVIEW: "bg-muted/50 text-foreground border-border/60",
  DONE: "bg-muted/50 text-foreground border-border/60",
};

export function TaskDashboard() {
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const userId = session?.user?.id as string | undefined;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Person[]>([]);
  const [staff, setStaff] = useState<Person[]>([]);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reassignTaskId, setReassignTaskId] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error();
      const _taskData = await res.json();
      setTasks(_taskData.data || _taskData);
    } catch {
      setError("Couldn't load tasks. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    if (role && canCreateTask(role)) {
      fetch("/api/clients")
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((res) => setClients(res.data || []));
      fetch("/api/users?role=STAFF")
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((res) => setStaff(res.data || []));
    }
  }, [loadTasks, role]);

  async function updateStatus(taskId: string, status: TaskStatus) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadTasks();
  }

  async function reassign(taskId: string, assignedToId: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToId }),
    });
    setReassignTaskId(null);
    loadTasks();
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
    });
    setCreateOpen(false);
    loadTasks();
  }

  const visibleTasks =
    statusFilter === "ALL" ? tasks : tasks.filter((t) => t.status === statusFilter);
  const canEditStatus = (task: Task) => !!role && (isStaffLeadership(role) || task.assignedTo?.id === userId);
  const canReassign = !!role && canReassignTask(role);

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground/90">Tasks</h1>
          <p className="text-sm text-muted-foreground">
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
                  e.preventDefault();
                  createTask(new FormData(e.currentTarget));
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

      <div className="flex flex-wrap gap-2 animate-fade-in" style={{ animationDelay: "100ms" }}>
        {(["ALL", "NOT_STARTED", "IN_PROGRESS", "REVIEW", "DONE"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150",
              statusFilter === s
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-muted-foreground border-border hover:bg-muted/50 hover:text-foreground"
            )}
          >
            {s === "ALL" ? "All" : STATUS_LABEL[s as TaskStatus]}
          </button>
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
        <div className="bg-card border border-border rounded-2xl shadow-sm px-4 py-16 flex flex-col items-center justify-center gap-3 text-center animate-fade-in">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No tasks match this filter</p>
          <p className="text-xs text-muted-foreground">Try selecting a different status or create a new task.</p>
        </div>
      ) : (
        <div className="animate-fade-in" style={{ animationDelay: "200ms" }}>
          {/* Mobile Cards */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {visibleTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                canEditStatus={canEditStatus(task)}
                canReassign={canReassign}
                currentAssigneeId={task.assignedTo?.id ?? null}
                onStatusChange={updateStatus}
                onReassign={reassign}
                reassignOpenTaskId={reassignTaskId}
                setReassignOpenTaskId={setReassignTaskId}
                staff={staff}
                statusLabels={STATUS_LABEL}
                statusStyles={STATUS_STYLE}
              />
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Task</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Client</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Assigned to</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Due</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  {canReassign && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    canEditStatus={canEditStatus(task)}
                    canReassign={canReassign}
                    currentAssigneeId={task.assignedTo?.id ?? null}
                    onStatusChange={updateStatus}
                    onReassign={reassign}
                    reassignOpenTaskId={reassignTaskId}
                    setReassignOpenTaskId={setReassignTaskId}
                    staff={staff}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TasksPage() {
  return <TaskDashboard />;
}