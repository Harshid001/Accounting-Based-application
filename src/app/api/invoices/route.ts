import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { withAuth, validateBody } from "@/lib/api/withAuth";
import { createInvoiceSchema, invoiceFiltersSchema } from "@/lib/api/validators";
import { ROLES } from "@/lib/permissions";

type Role = typeof ROLES[keyof typeof ROLES];

async function generateInvoiceNumber(year: string): Promise<{ seq: number; invoiceNumber: string }> {
  const lockKey = Number(hashLockKey(`afms:invoice:seq:${year}`));
  await prisma.$queryRaw`SELECT pg_advisory_xact_lock(${lockKey})`;
  const counter = await prisma.invoiceCounter.upsert({
    where: { id: year },
    create: { id: year, seq: 1 },
    update: { seq: { increment: 1 } },
  });
  return { seq: counter.seq, invoiceNumber: `INV-${year}-${String(counter.seq).padStart(4, "0")}` };
}

function hashLockKey(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i);
    h |= 0; // Convert to 32-bit integer
  }
  return h >>> 0; // Convert to unsigned 32-bit
}

function buildInvoiceWhereClause(role: Role, userId: string, clientId?: string | null) {
  if (role === ROLES.CLIENT) {
    return { clientId: userId };
  }
  if (role === ROLES.ADMIN) {
    return clientId ? { clientId } : {};
  }
  if (clientId) {
    return { clientId, client: { assignedTo: { some: { id: userId } } } };
  }
  return { client: { assignedTo: { some: { id: userId } } } };
}

async function checkClientAccess(clientId: string, userId: string, role: Role): Promise<boolean> {
  if (role === ROLES.ADMIN) return true;
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { assignedTo: { select: { id: true } } },
  });
  return !!client?.assignedTo.some((u) => u.id === userId);
}

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const userRole = user.role as Role;
  const userId = user.id;

  const isAllowedRole = 
    userRole === ROLES.ADMIN || 
    userRole === ROLES.MANAGER || 
    userRole === ROLES.ACCOUNTANT || 
    userRole === ROLES.DATA_ENTRY;
    
  if (!isAllowedRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const validated = validateBody(body, createInvoiceSchema);

  const { clientId, serviceSubscriptionId, dueDate, notes, lineItems } = validated;

  const hasAccess = await checkClientAccess(clientId, userId, userRole);
  if (!hasAccess) {
    return NextResponse.json({ error: "Unauthorized for this client" }, { status: 403 });
  }

  let subtotal = 0;
  let taxTotal = 0;

  const processedLineItems = lineItems.map((item) => {
    const qty = item.quantity ?? 1;
    const unitPrice = item.unitPrice;
    const taxRate = item.taxRate ?? 0;

    const itemSubtotal = qty * unitPrice;
    const itemTax = itemSubtotal * (taxRate / 100);

    subtotal += itemSubtotal;
    taxTotal += itemTax;

    return {
      description: item.description,
      quantity: qty,
      unitPrice: new Prisma.Decimal(unitPrice),
      taxRate: new Prisma.Decimal(taxRate),
      total: new Prisma.Decimal(itemSubtotal + itemTax),
    };
  });

  const total = subtotal + taxTotal;
  const year = new Date().getFullYear().toString();
  const { invoiceNumber } = await generateInvoiceNumber(year);

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      const createdInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          clientId,
          serviceSubscriptionId,
          dueDate: new Date(dueDate),
          subtotal: new Prisma.Decimal(subtotal),
          taxTotal: new Prisma.Decimal(taxTotal),
          total: new Prisma.Decimal(total),
          notes,
          lineItems: { create: processedLineItems },
        },
        include: { lineItems: true },
      });

      await tx.auditLog.create({
        data: {
          entityType: "Invoice",
          entityId: createdInvoice.id,
          action: "CREATE",
          userId,
          diff: JSON.parse(JSON.stringify(createdInvoice)),
        },
      });

      return createdInvoice;
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (creationError: unknown) {
    const errorMessage = creationError instanceof Error ? creationError.message : "Unknown error";
    console.error(`[InvoiceCreationError] Failed to create invoice ${invoiceNumber}, attempting VOID stub fallback:`, creationError);

    try {
      const voidStub = await prisma.invoice.create({
        data: {
          invoiceNumber,
          clientId,
          dueDate: new Date(dueDate),
          subtotal: new Prisma.Decimal(0),
          taxTotal: new Prisma.Decimal(0),
          total: new Prisma.Decimal(0),
          status: "VOID",
          notes: `SYSTEM_VOID: Invoice creation aborted after sequence allocation. Error: ${errorMessage}`,
        },
      });

      await prisma.auditLog.create({
        data: {
          entityType: "Invoice",
          entityId: voidStub.id,
          action: "CREATE",
          userId,
          diff: JSON.parse(JSON.stringify({ status: "VOID", reason: "SYSTEM_VOID_FALLBACK", originalError: errorMessage })),
        },
      });

      return NextResponse.json(
        { error: "Invoice creation failed. A VOID stub record was created to preserve GST sequence integrity.", invoiceNumber },
        { status: 500 }
      );
    } catch (voidStubError: unknown) {
      const voidErrorMessage = voidStubError instanceof Error ? voidStubError.message : "Unknown error";
      console.error(
        `[CRITICAL_COMPLIANCE_GAP] Failed to insert VOID stub for sequence ${invoiceNumber}. Manual reconciliation required!`,
        voidStubError
      );
      return NextResponse.json({ error: "Critical creation failure. Contact administrator." }, { status: 500 });
    }
  }
});

export const GET = withAuth(async (req: NextRequest, { user }) => {
  const userRole = user.role as Role;
  const userId = user.id;
  const { searchParams } = new URL(req.url);

  const filters = invoiceFiltersSchema.parse({
    page: searchParams.get("page"),
    pageSize: searchParams.get("pageSize"),
    clientId: searchParams.get("clientId"),
    status: searchParams.get("status"),
  });

  const whereClause = buildInvoiceWhereClause(userRole, userId, filters.clientId ?? undefined);
  if (filters.status) {
    Object.assign(whereClause, { status: filters.status });
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where: whereClause,
      select: {
        id: true,
        invoiceNumber: true,
        clientId: true,
        serviceSubscriptionId: true,
        issueDate: true,
        dueDate: true,
        subtotal: true,
        taxTotal: true,
        total: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        client: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.invoice.count({ where: whereClause }),
  ]);

  return NextResponse.json({ data: invoices, pagination: { page: filters.page, pageSize: filters.pageSize, total } });
});