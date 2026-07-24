"use client";

import { useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, XIcon, AlertTriangle, Calendar, User, Building2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "REVIEW" | "DONE";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  User: { id: string; name: string } | null;
}

export interface TaskWithDetails {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  client: { id: string; name: string } | null;
  assignedTo: { id: string; name: string; email: string } | null;
  complianceItem: { id: string; type: string } | null;
  Comment?: Comment[];
}

interface TaskDetailsDrawerProps {
  task: TaskWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDescriptionSave: (taskId: string, description: string) => Promise<void>;
  onAddComment: (taskId: string, content: string) => Promise<void>;
  canEditDetails: boolean;
}

function isOverdue(dueDate: string | null, status: TaskStatus): boolean {
  if (!dueDate || status === "DONE") return false;
  return new Date(dueDate) < new Date();
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  REVIEW: "Review",
  DONE: "Done",
};

const STATUS_STYLE: Record<TaskStatus, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-700 border-slate-200",
  IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200",
  REVIEW: "bg-purple-100 text-purple-700 border-purple-200",
  DONE: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TaskDetailsDrawer({
  task,
  open,
  onOpenChange,
  onDescriptionSave,
  onAddComment,
  canEditDetails,
}: TaskDetailsDrawerProps) {
  const [description, setDescription] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [savingDescription, setSavingDescription] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [lastTaskId, setLastTaskId] = useState<string | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Reset local state when the selected task changes (adjusting during render
  // avoids the set-state-in-effect anti-pattern).
  if (task && task.id !== lastTaskId) {
    setLastTaskId(task.id);
    setDescription(task.description ?? "");
    setEditingDescription(false);
  }

  if (!task) return null;

  const overdue = isOverdue(task.dueDate, task.status);
  const comments = task.Comment ?? [];

  async function handleSaveDescription() {
    if (!task) return;
    setSavingDescription(true);
    try {
      await onDescriptionSave(task.id, description);
      setEditingDescription(false);
    } finally {
      setSavingDescription(false);
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!task || !commentText.trim()) return;
    setPostingComment(true);
    try {
      await onAddComment(task.id, commentText.trim());
      setCommentText("");
      requestAnimationFrame(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    } finally {
      setPostingComment(false);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 isolate z-50 bg-black/20 duration-200 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed top-0 right-0 z-50 flex h-full w-full max-w-md flex-col bg-popover shadow-2xl ring-1 ring-foreground/10 outline-none duration-300 data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right"
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-border/50 px-5 py-4">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="truncate font-heading text-lg font-semibold leading-tight text-foreground">
                {task.title}
              </h2>
              <span
                className={cn(
                  "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                  STATUS_STYLE[task.status]
                )}
              >
                {STATUS_LABEL[task.status]}
              </span>
            </div>
            <DialogPrimitive.Close
              render={
                <Button variant="ghost" size="icon-sm" className="shrink-0" />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {/* Metadata */}
            <div className="grid grid-cols-2 gap-3">
              <MetadataItem
                icon={<Building2 className="h-4 w-4" />}
                label="Client"
                value={task.client?.name ?? "—"}
              />
              <MetadataItem
                icon={<User className="h-4 w-4" />}
                label="Assignee"
                value={task.assignedTo?.name ?? "Unassigned"}
              />
              <MetadataItem
                icon={<Calendar className="h-4 w-4" />}
                label="Due date"
                value={
                  task.dueDate ? formatDate(task.dueDate) : "No due date"
                }
                danger={overdue}
              />
              <MetadataItem
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Compliance"
                value={task.complianceItem?.type ?? "—"}
              />
            </div>

            {overdue && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                This task is overdue.
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Description
                </h3>
                {canEditDetails && !editingDescription && (
                  <button
                    onClick={() => setEditingDescription(true)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Edit
                  </button>
                )}
              </div>
              {editingDescription ? (
                <div className="space-y-2">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Add a description…"
                    className="resize-y"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveDescription}
                      disabled={savingDescription}
                    >
                      {savingDescription ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingDescription(false);
                        setDescription(task.description ?? "");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm text-foreground/90">
                  {task.description || (
                    <span className="text-muted-foreground italic">
                      No description yet.
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Comments */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Comments ({comments.length})
              </h3>
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No comments yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg bg-muted/50 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {c.User?.name ?? "Unknown"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDateTime(c.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">
                        {c.content}
                      </p>
                    </div>
                  ))}
                  <div ref={commentsEndRef} />
                </div>
              )}

              <form onSubmit={handleAddComment} className="space-y-2">
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={2}
                  placeholder="Write a comment…"
                  className="resize-y"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={postingComment || !commentText.trim()}
                >
                  {postingComment ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Comment
                </Button>
              </form>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function MetadataItem({
  icon,
  label,
  value,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-medium",
          danger ? "text-red-600" : "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}
