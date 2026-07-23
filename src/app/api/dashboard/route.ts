import { NextResponse } from 'next/server';

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ROLES, isStaffLeadership } from "@/lib/permissions";

import { prisma } from "@/lib/prisma";
import { appCache } from "@/lib/cache";

const DASHBOARD_CACHE_TTL = 60_000; // 60 seconds

function taskScopeWhere(user: any) {
  if (user.role === ROLES.ADMIN) return {};
  if (user.role === ROLES.MANAGER) {
    return {
      OR: [
        { assignedToId: user.id },
        { client: { assignedTo: { some: { id: user.id } } } },
      ],
    };
  }
  return { assignedToId: user.id };
}

function clientScopeWhere(user: any) {
  if (user.role === ROLES.ADMIN) return {};
  // For Manager, Accountant, Data Entry, it's clients they are assigned to.
  return { assignedTo: { some: { id: user.id } } };
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user;
    const isFullView = isStaffLeadership(user.role as any);

    // Check cache — key includes userId + role to prevent data leakage
    const cacheKey = `dashboard:${user.id}:${user.role}`;
    const cached = await appCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const tScope = taskScopeWhere(user);
    const cScope = clientScopeWhere(user);

    // 1. Pending Tasks
    const pendingTasks = await prisma.task.count({
      where: {
        AND: [
          tScope,
          { status: { not: 'DONE' } },
        ]
      }
    });

    // 2. Upcoming Deadlines (Compliance Items)
    const upcomingDeadlines = await prisma.complianceItem.count({
      where: {
        AND: [
          { client: cScope },
          { status: { notIn: ['FILED', 'ACKNOWLEDGED'] } }
        ]
      }
    });

    if (!isFullView) {
      // Lighter view for Accountant / Data Entry
      const result = { pendingTasks, upcomingDeadlines };
      await appCache.set(cacheKey, result, DASHBOARD_CACHE_TTL, ["dashboard"]);
      return NextResponse.json(result);
    }

    // Additional metrics for ADMIN / MANAGER
    const totalClients = await prisma.client.count({
      where: cScope
    });

    const pendingDocuments = await prisma.document.count({
      where: {
        AND: [
          { client: cScope },
          { archived: false }
        ]
      }
    });

    const completedFilings = await prisma.complianceItem.count({
      where: {
        AND: [
          { client: cScope },
          { status: { in: ['FILED', 'ACKNOWLEDGED'] } }
        ]
      }
    });

    // Employee Workload: list of users and their active task counts
    let workloadUserIds: string[] = [];

    if (user.role === ROLES.ADMIN) {
      // Admin sees workload for all staff users
      const allStaff = await prisma.user.findMany({ 
        where: { role: { not: ROLES.CLIENT } },
        select: { id: true } 
      });
      workloadUserIds = allStaff.map(u => u.id);
    } else if (user.role === ROLES.MANAGER) {
      // Manager sees workload for staff who share client assignments with them
      const sharedClients = await prisma.client.findMany({
        where: { assignedTo: { some: { id: user.id } } },
        select: {
          assignedTo: { select: { id: true } }
        }
      });
      const staffSet = new Set<string>();
      sharedClients.forEach(client => {
        client.assignedTo.forEach(staff => staffSet.add(staff.id));
      });
      // Always include themselves even if no shared clients
      staffSet.add(user.id);
      workloadUserIds = Array.from(staffSet);
    }

    const workloadQuery = await prisma.task.groupBy({
      by: ['assignedToId'],
      where: {
        AND: [
          { assignedToId: { in: workloadUserIds } },
          { status: { not: 'DONE' } }
        ]
      },
      _count: {
        id: true,
      }
    });

    const users = await prisma.user.findMany({
      where: { 
        id: { in: workloadUserIds },
        role: { not: ROLES.CLIENT }
      },
      select: { id: true, name: true, email: true }
    });

    // We want to return all relevant staff, even those with 0 pending tasks
    const employeeWorkload = users.map(u => {
      const taskCount = workloadQuery.find(w => w.assignedToId === u.id)?._count.id || 0;
      return {
        user: u,
        count: taskCount
      };
    });

    // Sort by task count descending
    employeeWorkload.sort((a, b) => b.count - a.count);

    const result = {
      totalClients,
      pendingTasks,
      pendingDocuments,
      upcomingDeadlines,
      completedFilings,
      employeeWorkload,
    };

    await appCache.set(cacheKey, result, DASHBOARD_CACHE_TTL, ["dashboard"]);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
