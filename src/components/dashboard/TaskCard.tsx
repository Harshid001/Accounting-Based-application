"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Users, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "REVIEW" | "DONE";

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    description?: string | null;
    status: TaskStatus;
    client: { id: string; name: string } | null;
    assignedTo: { id: string; name: string } | null;
    dueDate: string | null;
  };
  canEditStatus: boolean;
  canReassign: boolean;
  currentAssigneeId: string | null;
  onStatusChange: (taskId: string, status: TaskStatus) => Promise<void>;
  onReassign: (taskId: string, assignedToId: string) => Promise<void>;
  onCardClick?: (taskId: string) => void;
  reassignOpenTaskId: string | null;
  setReassignOpenTaskId: (taskId: string | null) => void;
  staff: { id: string; name: string }[];
  statusLabels: Record<TaskStatus, string>;
  statusStyles: Record<TaskStatus, string>;
}

function isOverdue(dueDate: string | null, status: TaskStatus): boolean {
  if (!dueDate || status === "DONE") return false;
  return new Date(dueDate) < new Date();
}

export function TaskCard({
  task,
  canEditStatus,
  canReassign,
  currentAssigneeId,
  onStatusChange,
  onReassign,
  onCardClick,
  reassignOpenTaskId,
  setReassignOpenTaskId,
  staff,
  statusLabels,
  statusStyles,
}: TaskCardProps) {
  const overdue = isOverdue(task.dueDate, task.status);
  return (
    <div
      onClick={() => onCardClick?.(task.id)}
      className={cn(
        "bg-card border border-border rounded-2xl shadow-sm p-4 flex flex-col gap-3 relative overflow-hidden hover:shadow-md transition-shadow duration-200",
        onCardClick && "cursor-pointer"
      )}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex flex-col gap-1">
          <span className="font-bold text-foreground text-base leading-tight">{task.title}</span>
          <span className="text-xs font-medium text-muted-foreground">{task.client?.name ?? "—"}</span>
        </div>
        {canReassign && (
          <Dialog
            open={reassignOpenTaskId === task.id}
            onOpenChange={(open) => setReassignOpenTaskId(open ? task.id : null)}
          >
            <DialogTrigger
              render={
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={(e: React.MouseEvent) => e.stopPropagation()} />
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reassign &ldquo;{task.title}&rdquo;</DialogTitle>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor={`reassign-mobile-${task.id}`}>New assignee</Label>
                <Select
                  value={currentAssigneeId ?? ""}
                  onValueChange={(value) => {
                    if (value) onReassign(task.id, value);
                  }}
                >
                  <SelectTrigger id={`reassign-mobile-${task.id}`}>
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          <span className={cn("inline-flex items-center gap-1 text-sm font-medium", overdue ? "text-red-600" : "text-foreground")}>
            {overdue && <AlertTriangle className="h-3.5 w-3.5" />}
            {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}
          </span>
        </div>
      </div>

      <div className="pt-2" onClick={(e) => e.stopPropagation()}>
        {canEditStatus ? (
          <Select
            value={task.status}
            onValueChange={(v) => onStatusChange(task.id, v as TaskStatus)}
          >
            <SelectTrigger className={cn("h-8 w-full border-none text-xs font-medium", statusStyles[task.status])}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["NOT_STARTED", "IN_PROGRESS", "REVIEW", "DONE"] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge className={cn("w-full justify-center py-1.5", statusStyles[task.status])}>
            {statusLabels[task.status]}
          </Badge>
        )}
      </div>
    </div>
  );
}