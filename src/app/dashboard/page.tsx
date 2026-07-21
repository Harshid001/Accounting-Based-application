'use client';

import { useEffect, useState } from 'react';
import { Loader2, Users, ClipboardList, Clock, FileStack, Plus, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/dashboard');
        if (res.ok) {
          const data = await res.json();
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
    ...(isFullView ? [{
      title: "Total Clients",
      value: stats.totalClients,
      icon: Users,
      glow: "from-blue-500/20 to-indigo-500/5 dark:from-blue-500/30 dark:to-indigo-500/10",
      text: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10 dark:bg-blue-500/20",
      href: "/dashboard/clients"
    }] : []),
    {
      title: "Pending Tasks",
      value: stats?.pendingTasks ?? 0,
      icon: ClipboardList,
      glow: "from-orange-500/20 to-amber-500/5 dark:from-orange-500/30 dark:to-amber-500/10",
      text: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-500/10 dark:bg-orange-500/20",
      href: "/dashboard/tasks"
    },
    {
      title: "Upcoming Deadlines",
      value: stats?.upcomingDeadlines ?? 0,
      icon: Clock,
      glow: "from-red-500/20 to-rose-500/5 dark:from-red-500/30 dark:to-rose-500/10",
      text: "text-red-600 dark:text-red-400",
      bg: "bg-red-500/10 dark:bg-red-500/20",
      href: "/dashboard/taxes"
    },
    ...(isFullView ? [{
      title: "Pending Documents",
      value: stats?.pendingDocuments,
      icon: FileStack,
      glow: "from-purple-500/20 to-fuchsia-500/5 dark:from-purple-500/30 dark:to-fuchsia-500/10",
      text: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-500/10 dark:bg-purple-500/20",
      href: "/dashboard/clients"
    }] : []),
  ];

  return (
    <div className="space-y-10 md:space-y-12 pb-8">
      
      {/* Top Header & Actions Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 animate-slide-up">
        
        {/* Greeting */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
            {isFullView ? 'Firm Overview' : 'My Dashboard'}
          </h1>
          <p className="text-base text-muted-foreground font-medium">
            Here's what is happening across your firm today.
          </p>
        </div>


      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <Link href={card.href || "#"} key={i} className="block group animate-slide-up" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="relative overflow-hidden rounded-3xl glass-card p-6 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-xl h-full border border-border/50 hover:border-primary/30 cursor-pointer bg-card/40 backdrop-blur-sm">
                {/* Premium Background Glow Effect */}
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50 transition-opacity duration-500 group-hover:opacity-100", card.glow)} />
                
                <div className="relative z-10 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl shadow-inner transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3", card.bg, card.text)}>
                      <Icon className="h-6 w-6" strokeWidth={2} />
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background/50 backdrop-blur-sm opacity-0 -translate-x-4 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
                      <ArrowRight className="h-4 w-4 text-foreground/70" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-4xl md:text-5xl font-bold text-foreground tracking-tight drop-shadow-sm">
                      {card.value}
                    </div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{card.title}</h3>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {isFullView && stats.employeeWorkload && stats.employeeWorkload.length > 0 && (
        <div className="rounded-3xl glass-card mt-10 overflow-hidden animate-slide-up" style={{ animationDelay: '400ms' }}>
          <div className="border-b border-border/50 bg-background/30 px-8 py-6 backdrop-blur-md">
            <h2 className="text-xl font-bold text-foreground tracking-tight">Employee Workload</h2>
            <p className="text-sm text-muted-foreground mt-1 font-medium">Active tasks assigned to staff members</p>
          </div>
          <div className="divide-y divide-border/30 bg-card/20">
            {stats.employeeWorkload.map((work: any, index: number) => {
              // Calculate a simulated progress bar percentage (max 20 tasks for 100%)
              const percentage = Math.min((work.count / 20) * 100, 100);
              const isHighLoad = work.count > 15;
              
              return (
                <div key={work.user.id} className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-8 py-5 transition-colors hover:bg-muted/20">
                  <div className="flex items-center gap-4 min-w-[200px]">
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-primary/80 to-primary/40 text-primary-foreground font-bold shadow-md ring-2 ring-background transition-transform group-hover:scale-105">
                      {(work.user.name || work.user.email).charAt(0).toUpperCase()}
                    </div>
                    <span className="font-semibold text-foreground">
                      {work.user.name || work.user.email}
                    </span>
                  </div>
                  
                  {/* Progress Bar Area */}
                  <div className="flex-1 max-w-md w-full flex items-center gap-4">
                    <div className="h-2 flex-1 rounded-full bg-secondary/50 overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-1000 ease-out", 
                          isHighLoad ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                        )}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="flex flex-col items-end min-w-[60px]">
                      <span className="font-bold text-foreground">{work.count}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Tasks</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  )
}
