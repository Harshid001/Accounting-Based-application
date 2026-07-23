'use client';

import { useEffect, useState } from 'react';
import { Loader2, Users, ClipboardList, Clock, FileStack, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface DashboardStats {
  totalClients?: number;
  pendingTasks?: number;
  upcomingDeadlines?: number;
  pendingDocuments?: number;
  employeeWorkload?: {
    user: { name: string | null; email: string | null };
    count: number;
  }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/dashboard');
        if (res.ok) {
          const _resData = await res.json()
          const data = _resData.data || _resData;
          setStats(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-muted-foreground animate-pulse">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-medium tracking-wider uppercase">Loading dashboard...</p>
      </div>
    );
  }

  const isFullView = stats?.totalClients !== undefined;

  const cards = [
    ...(isFullView ? [{ title: "Total Clients", value: stats.totalClients, icon: Users, href: "/dashboard/clients" }] : []),
    { title: "Pending Tasks", value: stats?.pendingTasks ?? 0, icon: ClipboardList, href: "/dashboard/tasks" },
    { title: "Upcoming Deadlines", value: stats?.upcomingDeadlines ?? 0, icon: Clock, href: "/dashboard/taxes" },
    ...(isFullView ? [{ title: "Pending Documents", value: stats?.pendingDocuments, icon: FileStack, href: "/dashboard/clients" }] : []),
  ];

  return (
    <div className="space-y-10 pb-8">

      {/* Page Header */}
      <div className="flex flex-col gap-1.5 animate-slide-up">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground/90">
          {isFullView ? 'Firm Overview' : 'My Dashboard'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what is happening across your firm today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <Link href={card.href || "#"} key={i} className="block group animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="relative bg-card border border-border rounded-2xl p-6 shadow-sm transition-all duration-200 hover:-translate-y-[2px] hover:shadow-md h-full cursor-pointer">
                <div className="flex items-start justify-between mb-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </div>
                <div className="space-y-1">
                  <div className="text-4xl md:text-5xl font-bold text-foreground tabular-nums tracking-tight">
                    {card.value}
                  </div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{card.title}</p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Employee Workload */}
      {isFullView && stats.employeeWorkload && stats.employeeWorkload.length > 0 ? (
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden animate-slide-up" style={{ animationDelay: '320ms' }}>
          <div className="border-b border-border px-8 py-5">
            <h2 className="text-base font-semibold text-foreground">Employee Workload</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Active tasks assigned to staff members</p>
          </div>
          <div className="divide-y divide-border/60">
            {stats.employeeWorkload.map((work) => {
              const percentage = Math.min((work.count / 20) * 100, 100);
              const isHighLoad = work.count > 15;
              return (
                <div key={work.user.id} className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-8 py-4 transition-colors duration-150 hover:bg-muted/30">
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm border border-border/50 ring-2 ring-background shrink-0">
                      {(work.user.name || work.user.email).charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-foreground text-sm">
                      {work.user.name || work.user.email}
                    </span>
                  </div>

                  <div className="flex-1 max-w-md w-full flex items-center gap-4">
                    <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-700 ease-out",
                          isHighLoad ? "bg-destructive" : "bg-primary"
                        )}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="flex flex-col items-end min-w-[52px]">
                      <span className="font-bold text-foreground text-sm tabular-nums">{work.count}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Tasks</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : isFullView ? (
        <div className="bg-card border border-border rounded-2xl shadow-sm p-12 flex flex-col items-center justify-center text-center animate-slide-up gap-3">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No active workload</p>
          <p className="text-xs text-muted-foreground">Staff members have no pending tasks right now.</p>
        </div>
      ) : null}
    </div>
  )
}


