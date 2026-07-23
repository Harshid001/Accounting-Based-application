"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ReassignTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  currentAssigneeId: string | null;
  staff: { id: string; name: string }[];
  onReassign: (taskId: string, assignedToId: string) => Promise<void>;
  taskId: string;
}

export function ReassignTaskDialog({ open, onOpenChange, taskTitle, currentAssigneeId, staff, onReassign, taskId }: ReassignTaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign &ldquo;{taskTitle}&rdquo;</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5 py-2">
          <Label htmlFor={`reassign-${taskId}`}>New assignee</Label>
          <Select
            value={currentAssigneeId ?? ""}
            onValueChange={(value) => {
              if (value) onReassign(taskId, value);
            }}
          >
            <SelectTrigger id={`reassign-${taskId}`}>
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
  );
}