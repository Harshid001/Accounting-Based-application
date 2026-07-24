"use client";

/**
 * Staff Tasks dashboard.
 *
 * Data contract:
 *   GET   /api/tasks              -> Task[] (supports search, clientId, assigneeId, status, sortBy, sortOrder)
 *   PATCH /api/tasks/[id]         -> { status? } for assigned staff,
 *                                     { status?, assignedToId?, description? } for Admin/Manager
 *   POST  /api/tasks              -> { title, clientId, assignedToId, dueDate?, description?, complianceItemId? }
 *   GET   /api/clients            -> { id, name }[]        (Create dialog + filters)
 *   GET   /api/users?role=STAFF   -> { id, name }[]         (assignee pickers + filters)
 *   GET   /api/compliance?clientId -> compliance items for selected client
 *   POST  /api/comments           -> { content, parentType: "task", parentId }
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, ClipboardList, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  canCreateTask,
  canReassignTask,
  isStaffLeadership,
  type Role,
} from "@/lib/permissions";
import { TaskRow } from "@/components/dashboard/TaskRow";
import { TaskCard } from "@/components/dashboard/TaskCard";
import {
  TaskDetailsDrawer,
  type TaskWithDetails,
} from "@/components/dashboard/TaskDetailsDrawer";

type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "REVIEW" | "DONE";
type SortBy = "dueDate" | "createdAt";

type Task = TaskWithDetails;

interface Person {
  id: string;
  name: string;
}

interface ComplianceItem {
  id: string;
  type: string;
  status: string;
  dueDate: string;
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  REVIEW: "Review",
  DONE: "Done",
};

const STATUS_STYLE: Record<TaskStatus, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200",
  IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200",
  REVIEW: "bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200",
  DONE: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200",
};

export function TaskDashboardClient({ initialTasks, initialStaff }: { initialTasks: Task[], initialStaff: Person[] }) {
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const userId = session?.user?.id as string | undefined;

  const [tasks, setTasks] = useState<Task[]>(initialTasks || []);
  const [staff, setStaff] = useState<Person[]>(initialStaff || []);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reassignTaskId, setReassignTaskId] = useState<string | null>(null);

  // Filtering & sorting state
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<SortBy>("dueDate");

  // Drawer state
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadTasksRef = useRef<() => void>(() => {});

  const isLeadership = !!role && isStaffLeadership(role);

  // Keep track of whether it's the first render to avoid redundant fetching
  const isFirstRender = useRef(true);

  useEffect(() => {
    let cancelled = false;
    const loadTasks = async () => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
      try {
        const params = new URLSearchParams();
        if (searchQuery) params.set("search", searchQuery);
        if (assigneeFilter !== "ALL") params.set("assigneeId", assigneeFilter);
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        params.set("sortBy", sortBy);

        const res = await fetch(`/api/tasks?${params.toString()}`);
        if (!res.ok) throw new Error();
        const _taskData = await res.json();
        if (!cancelled) setTasks(_taskData.data || _taskData);
      } catch {
        if (!cancelled) setError("Couldn't load tasks. Try refreshing.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadTasksRef.current = loadTasks;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    loadTasks();
    return () => { cancelled = true };
  }, [searchQuery, assigneeFilter, statusFilter, sortBy]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Removed redundant loadTasksRef.current() call because it's now handled directly in the loadTasks useEffect above.

  async function updateStatus(taskId: string, status: TaskStatus) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadTasksRef.current();
    if (drawerTaskId === taskId) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status } : t))
      );
    }
  }

  async function reassign(taskId: string, assignedToId: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToId }),
    });
    setReassignTaskId(null);
    loadTasksRef.current();
  }

  async function saveDescription(taskId: string, description: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, description } : t))
    );
  }

  async function addComment(taskId: string, content: string) {
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        parentType: "task",
        parentId: taskId,
      }),
    });
    if (res.ok) {
      const newComment = await res.json();
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, Comment: [...(t.Comment ?? []), newComment] }
            : t
        )
      );
    }
  }

  const openDrawer = useCallback((taskId: string) => {
    setDrawerTaskId(taskId);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const drawerTask = tasks.find((t) => t.id === drawerTaskId) ?? null;

  const visibleTasks = tasks;
  const canEditStatus = (task: Task) =>
    !!role && (isStaffLeadership(role) || task.assignedTo?.id === userId);
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
          <Link href="/dashboard/tasks/new">
            <Button className="h-10 shrink-0 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all bg-primary text-primary-foreground flex items-center gap-2">
              Create Task
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </Button>
          </Link>
        )}
      </div>

      {/* Search & Filters Bar */}
      <div className="flex flex-col md:flex-row items-center gap-3 animate-fade-in" style={{ animationDelay: "50ms" }}>
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search tasks by title or description…"
            className="pl-9 pr-9 w-full"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Assignee filter (managers/admins only) */}
          {isLeadership && (
            <Select value={assigneeFilter} onValueChange={(v) => setAssigneeFilter(v ?? "ALL")}>
              <SelectTrigger size="sm" className="w-[160px]">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All assignees</SelectItem>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Sort by */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger size="sm" className="w-[150px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dueDate">Due date</SelectItem>
              <SelectItem value="createdAt">Creation date</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Status filter pills */}
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
          <Button size="sm" variant="outline" onClick={() => loadTasksRef.current()}>
            Retry
          </Button>
        </div>
      ) : visibleTasks.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl shadow-sm px-4 py-16 flex flex-col items-center justify-center gap-3 text-center animate-fade-in">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No tasks match this filter</p>
          <p className="text-xs text-muted-foreground">Try adjusting your search or filters, or create a new task.</p>
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
                onCardClick={openDrawer}
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
                    onRowClick={openDrawer}
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

      {/* Task Details Drawer */}
      <TaskDetailsDrawer
        task={drawerTask}
        open={drawerOpen}
        onOpenChange={(open) => { if (!open) closeDrawer(); }}
        onDescriptionSave={saveDescription}
        onAddComment={addComment}
        canEditDetails={isLeadership}
      />
    </div>
  );
}


