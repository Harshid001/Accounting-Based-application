"use client";

import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";

type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "REVIEW" | "DONE";

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

interface TaskRowProps {
  task: {
    id: string;
    title: string;
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
  reassignOpenTaskId: string | null;
  setReassignOpenTaskId: (taskId: string | null) => void;
  staff: { id: string; name: string }[];
}

export function TaskRow({
  task,
  canEditStatus,
  canReassign,
  currentAssigneeId,
  onStatusChange,
  onReassign,
  reassignOpenTaskId,
  setReassignOpenTaskId,
  staff,
}: TaskRowProps) {
  return (
    <TableRow className="transition-colors duration-150 hover:bg-muted/30 border-b border-border/50">
      <TableCell className="font-medium text-foreground">{task.title}</TableCell>
      <TableCell className="text-muted-foreground">{task.client?.name ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">
        {task.assignedTo?.name ?? "Unassigned"}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}
      </TableCell>
      <TableCell>
        {canEditStatus ? (
          <Select
            value={task.status}
            onValueChange={(v) => onStatusChange(task.id, v as TaskStatus)}
          >
            <SelectTrigger className={cn("h-8 w-[140px] border-none text-xs font-medium", STATUS_STYLE[task.status])}>
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
          <Badge className={cn(STATUS_STYLE[task.status])}>{STATUS_LABEL[task.status]}</Badge>
        )}
      </TableCell>
      {canReassign && (
        <TableCell className="w-10">
          <Dialog
            open={reassignOpenTaskId === task.id}
            onOpenChange={(open) => setReassignOpenTaskId(open ? task.id : null)}
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
                <Select
                  value={currentAssigneeId ?? ""}
                  onValueChange={(value) => {
                    if (value) onReassign(task.id, value);
                  }}
                >
                  <SelectTrigger id={`reassign-${task.id}`}>
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
        </TableCell>
      )}
    </TableRow>
  );
}