'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, CheckCircle2, User, Building, AlignLeft, Calendar } from 'lucide-react';

interface TaskUser {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
}

interface TaskClient {
  id: string;
  name: string;
}

interface TaskComplianceItem {
  id: string;
  clientId: string;
  type: string;
  status: string;
  dueDate: string;
}

export default function NewTaskPage() {
  const router = useRouter();
  const [users, setUsers] = useState<TaskUser[]>([]);
  const [clients, setClients] = useState<TaskClient[]>([]);
  const [complianceItems, setComplianceItems] = useState<TaskComplianceItem[]>([]);
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    assignedToId: '',
    clientId: '',
    complianceItemId: '',
    dueDate: ''
  });
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [usersRes, clientsRes, complianceRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/clients'),
          fetch('/api/compliance-items')
        ]);
        
        if (usersRes.ok) setUsers(await usersRes.json());
        if (clientsRes.ok) setClients(await clientsRes.json());
        if (complianceRes.ok) setComplianceItems(await complianceRes.json());
      } catch (err) {
        console.error('Failed to load form data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.assignedToId) {
      alert('Title and Assignee are required.');
      return;
    }

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (res.ok) {
        router.push('/dashboard/tasks');
      } else {
        const _resData = await res.json()
          const data = _resData.data || _resData;
        alert(data.error || 'Failed to create task');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred');
    }
  }

  // Filter compliance items by selected client if one is selected
  const availableComplianceItems = form.clientId 
    ? complianceItems.filter(c => c.clientId === form.clientId)
    : complianceItems;

  if (loading) {
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
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Create New Task</h1>
          <p className="text-sm text-muted-foreground">Assign work to your team members and link it to clients.</p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="rounded-3xl glass-card p-6 md:p-8 space-y-8 border border-border/50 shadow-sm relative overflow-hidden">
        {/* Decorative background blur */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

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
            <textarea 
              id="desc"
              rows={4}
              placeholder="Add any helpful details or instructions..."
              className="flex w-full rounded-xl border border-input bg-background/50 px-3 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent transition-all"
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
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.email} <span className="text-muted-foreground text-xs ml-1">({u.role})</span>
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
              onValueChange={(v) => v && setForm({...form, clientId: v === "none" ? "" : v, complianceItemId: ''})}
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
              Related Compliance Item (Optional)
            </Label>
            <Select 
              value={form.complianceItemId} 
              onValueChange={(v) => v && setForm({...form, complianceItemId: v === "none" ? "" : v})}
              disabled={!form.clientId && complianceItems.length > 0} 
            >
              <SelectTrigger className="h-12 bg-background/50">
                <SelectValue placeholder={!form.clientId ? "Select a client first..." : "None"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {availableComplianceItems.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.type} ({c.status}) - Due: {new Date(c.dueDate).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!form.clientId && <p className="text-[11px] text-muted-foreground mt-1">You must select a client before linking a compliance item.</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/50">
          <Button type="button" variant="ghost" onClick={() => router.back()} className="rounded-xl px-6">
            Cancel
          </Button>
          <Button type="submit" className="rounded-xl shadow-md hover:shadow-lg transition-all px-8 h-11 text-base font-semibold">
            Create Task
          </Button>
        </div>
      </form>
    </div>
  );
}
