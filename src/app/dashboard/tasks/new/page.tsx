"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, CheckCircle2, User, Building, AlignLeft, Calendar, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { canCreateTask, type Role } from "@/lib/permissions";

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

export default function NewTaskPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;

  const [clients, setClients] = useState<Person[]>([]);
  const [staff, setStaff] = useState<Person[]>([]);
  const [complianceItems, setComplianceItems] = useState<ComplianceItem[]>([]);
  
  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedToId: "",
    clientId: "",
    complianceItemId: "",
    dueDate: "",
  });

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (role && canCreateTask(role)) {
      Promise.all([
        fetch("/api/clients").then((r) => (r.ok ? r.json() : { data: [] })),
        fetch("/api/users?role=STAFF").then((r) => (r.ok ? r.json() : { data: [] })),
      ])
        .then(([clientsRes, staffRes]) => {
          if (!cancelled) {
            setClients(clientsRes.data || clientsRes || []);
            setStaff(staffRes.data || staffRes || []);
            setLoadingInitial(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError("Failed to load necessary data. Please refresh.");
            setLoadingInitial(false);
          }
        });
    } else if (role && !canCreateTask(role)) {
      setLoadingInitial(false);
    }

    return () => {
      cancelled = true;
    };
  }, [role]);

  async function loadComplianceForClient(clientId: string | null) {
    setForm(prev => ({ ...prev, clientId: clientId || "", complianceItemId: "" }));
    if (!clientId || clientId === "none") {
      setComplianceItems([]);
      return;
    }
    try {
      const res = await fetch(`/api/compliance?clientId=${clientId}&pageSize=100`);
      if (res.ok) {
        const data = await res.json();
        setComplianceItems(data.data || []);
      } else {
        setComplianceItems([]);
      }
    } catch {
      setComplianceItems([]);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.title || !form.assignedToId) {
      setError("Title and Assignee are required.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          clientId: form.clientId === "none" ? null : form.clientId || null,
          assignedToId: form.assignedToId,
          complianceItemId: form.complianceItemId === "none" ? null : form.complianceItemId || null,
          dueDate: form.dueDate || null,
        }),
      });

      if (!res.ok) {
        const _resData = await res.json();
        throw new Error(_resData.error || "Failed to create task");
      }

      router.push("/dashboard/tasks");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An error occurred");
      setSubmitting(false);
    }
  }

  if (role && !canCreateTask(role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-muted-foreground animate-fade-in">
        <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
        <p className="mt-2 text-sm">You do not have permission to create tasks.</p>
        <Button variant="outline" className="mt-6" onClick={() => router.push('/dashboard/tasks')}>
          Return to Tasks
        </Button>
      </div>
    );
  }

  if (loadingInitial) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-muted-foreground animate-pulse">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-medium tracking-wider uppercase">Loading form...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-slide-up">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/tasks')} className="rounded-full hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Create New Task</h1>
          <p className="text-sm text-muted-foreground">Assign work to your team members and link it to clients.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-3xl bg-card p-6 md:p-8 space-y-8 border border-border shadow-sm relative overflow-hidden">
        {/* Decorative background blur */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 relative z-10">
            {error}
          </div>
        )}

        <div className="space-y-6 relative z-10">
          <div className="space-y-2">
            <Label htmlFor="title" className="flex items-center gap-2 text-foreground font-semibold">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Task Title *
            </Label>
            <Input 
              id="title"
              placeholder="e.g. Prepare Q2 Tax Documents"
              value={form.title}
              onChange={(e) => setForm({...form, title: e.target.value})}
              required
              className="h-12 bg-background/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc" className="flex items-center gap-2 text-foreground font-semibold">
              <AlignLeft className="h-4 w-4 text-muted-foreground" /> Description
            </Label>
            <Textarea 
              id="desc"
              rows={4}
              placeholder="Add any helpful details or instructions..."
              className="bg-background/50 resize-y"
              value={form.description}
              onChange={(e) => setForm({...form, description: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-foreground font-semibold">
                <User className="h-4 w-4 text-orange-500" /> Assign To *
              </Label>
              <Select 
                value={form.assignedToId} 
                onValueChange={(v) => v && setForm({...form, assignedToId: v})}
                required
              >
                <SelectTrigger className="h-12 bg-background/50">
                  <SelectValue placeholder="Select Assignee" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-foreground font-semibold">
                <Calendar className="h-4 w-4 text-purple-500" /> Due Date
              </Label>
              <Input 
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({...form, dueDate: e.target.value})}
                className="h-12 bg-background/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-foreground font-semibold">
              <Building className="h-4 w-4 text-blue-500" /> Client (Optional)
            </Label>
            <Select 
              value={form.clientId} 
              onValueChange={(v) => loadComplianceForClient(v)}
            >
              <SelectTrigger className="h-12 bg-background/50">
                <SelectValue placeholder="None / Internal Task" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None / Internal Task</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-foreground font-semibold">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Related Compliance Item (Optional)
            </Label>
            <Select 
              value={form.complianceItemId} 
              onValueChange={(v) => v && setForm({...form, complianceItemId: v})}
              disabled={!form.clientId || form.clientId === "none" || complianceItems.length === 0} 
            >
              <SelectTrigger className="h-12 bg-background/50">
                <SelectValue placeholder={!form.clientId || form.clientId === "none" ? "Select a client first..." : "None"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {complianceItems.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.type} ({c.status}) - Due: {new Date(c.dueDate).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(!form.clientId || form.clientId === "none") && <p className="text-[11px] text-muted-foreground mt-1">You must select a client before linking a compliance item.</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/50 relative z-10">
          <Button type="button" variant="ghost" onClick={() => router.push('/dashboard/tasks')} className="rounded-xl px-6">
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} className="rounded-xl shadow-md hover:shadow-lg transition-all px-8 h-11 text-base font-semibold min-w-[140px]">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Task"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
