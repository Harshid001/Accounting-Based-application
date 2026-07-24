import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { ClientsClient } from "./ClientsClient";

export default async function ClientsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const userRole = session.user.role;
  const userId = session.user.id;

  let baseWhere = {};
  if (userRole !== ROLES.ADMIN && userRole !== ROLES.MANAGER) {
    baseWhere = { assignedTo: { some: { id: userId } } };
  }

  const [initialClients, initialTotal] = await Promise.all([
    prisma.client.findMany({
      where: baseWhere,
      include: {
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        services: { include: { service: { select: { id: true, name: true } } } },
        _count: {
          select: { complianceItems: true, tasks: true, documents: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.client.count({ where: baseWhere }),
  ]);

  return (
    <ClientsClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialClients={initialClients as any}
      initialTotal={initialTotal}
    />
  );
}
