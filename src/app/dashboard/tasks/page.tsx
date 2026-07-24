import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { TaskDashboardClient } from "./TaskDashboardClient";

export default async function TasksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const userRole = session.user.role;
  const userId = session.user.id;

  let scope = {};
  if (userRole === ROLES.MANAGER) {
    scope = {
      OR: [
        { assignedToId: userId },
        { client: { assignedTo: { some: { id: userId } } } },
      ],
    };
  } else if (userRole !== ROLES.ADMIN) {
    scope = { assignedToId: userId };
  }

  // Fetch initial tasks (default sort by dueDate asc)
  const initialTasks = await prisma.task.findMany({
    where: scope,
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      client: { select: { id: true, name: true } },
      complianceItem: { select: { id: true, type: true } },
      Comment: {
        include: { User: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: 50,
  });

  // Fetch initial staff if user can create tasks
  let initialStaff: { id: string; name: string }[] = [];
  if (userRole === ROLES.ADMIN || userRole === ROLES.MANAGER) {
    const users = await prisma.user.findMany({
      where: { role: { not: "CLIENT" } },
      select: { id: true, name: true },
    });
    initialStaff = users.map(u => ({ id: u.id, name: u.name || "Unknown" }));
  }

  return (
    <TaskDashboardClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialTasks={initialTasks as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialStaff={initialStaff as any}
    />
  );
}
