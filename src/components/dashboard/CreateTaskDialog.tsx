"use client";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: { id: string; name: string }[];
  staff: { id: string; name: string }[];
  onSubmit: (data: {
    title: string;
    clientId: string;
    assignedToId: string;
    dueDate?: string | null;
  }) => Promise<void>;
}

export function CreateTaskDialog({ open, onOpenChange, clients, staff, onSubmit }: CreateTaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a task</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            await onSubmit({
              title: formData.get("title") as string,
              clientId: formData.get("clientId") as string,
              assignedToId: formData.get("assignedToId") as string,
              dueDate: (formData.get("dueDate") as string) || null,
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clientId">Client</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assignedToId">Assign to</Label>
            <Select>
              <SelectTrigger>
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
  );
}