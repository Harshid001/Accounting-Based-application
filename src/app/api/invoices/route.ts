import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Retry helper for atomic invoice generation
async function generateInvoiceNumber(year: string, maxRetries = 3): Promise<{ seq: number, invoiceNumber: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Upsert the counter for the year
      const counter = await prisma.invoiceCounter.upsert({
        where: { id: year },
        create: { id: year, seq: 1 },
        update: { seq: { increment: 1 } },
      });
      
      const invoiceNumber = `INV-${year}-${String(counter.seq).padStart(4, "0")}`;
      return { seq: counter.seq, invoiceNumber };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        if (attempt === maxRetries) throw new Error("Max retries reached generating invoice number");
        // Wait a bit before retrying
        await new Promise(res => setTimeout(res, 50 * attempt));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Failed to generate invoice number");
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = session.user.role;
    const userId = session.user.id;
    if (!["ADMIN", "MANAGER", "ACCOUNTANT"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { clientId, serviceSubscriptionId, dueDate, notes, lineItems } = body;

    if (!clientId || !lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Client scoping check
    if (userRole !== "ADMIN") {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        include: { assignedTo: { select: { id: true } } }
      });
      if (!client || !client.assignedTo.some(u => u.id === userId)) {
        return NextResponse.json({ error: "Unauthorized for this client" }, { status: 403 });
      }
    }

    // 1. Calculate totals server-side
    let subtotal = 0;
    let taxTotal = 0;
    
    const processedLineItems = lineItems.map((item: any) => {
      const qty = item.quantity || 1;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      const taxRate = parseFloat(item.taxRate) || 0;
      
      const itemSubtotal = qty * unitPrice;
      const itemTax = itemSubtotal * (taxRate / 100);
      const itemTotal = itemSubtotal + itemTax;
      
      subtotal += itemSubtotal;
      taxTotal += itemTax;
      
      return {
        description: item.description,
        quantity: qty,
        unitPrice: new Prisma.Decimal(unitPrice),
        taxRate: new Prisma.Decimal(taxRate),
        total: new Prisma.Decimal(itemTotal)
      };
    });

    const total = subtotal + taxTotal;
    const year = new Date().getFullYear().toString();

    // 2. Fast atomic sequence allocation outside long transaction
    const counter = await prisma.invoiceCounter.upsert({
      where: { id: year },
      create: { id: year, seq: 1 },
      update: { seq: { increment: 1 } },
    });
    const invoiceNumber = `INV-${year}-${String(counter.seq).padStart(4, "0")}`;

    // 3. Create the real invoice
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
            lineItems: {
              create: processedLineItems
            }
          },
          include: {
            lineItems: true
          }
        });

        await tx.auditLog.create({
          data: {
            entityType: "Invoice",
            entityId: createdInvoice.id,
            action: "CREATE",
            userId: userId,
            diff: JSON.parse(JSON.stringify(createdInvoice))
          }
        });

        return createdInvoice;
      });

      return NextResponse.json(invoice, { status: 201 });
    } catch (creationError: any) {
      console.error(`[InvoiceCreationError] Failed to create invoice ${invoiceNumber}, attempting VOID stub fallback:`, creationError);
      
      // Step 3 Fallback: Create VOID stub to preserve gapless GST sequence requirement
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
            notes: `SYSTEM_VOID: Invoice creation aborted after sequence allocation. Error: ${creationError.message || "Unknown error"}`
          }
        });

        await prisma.auditLog.create({
          data: {
            entityType: "Invoice",
            entityId: voidStub.id,
            action: "CREATE",
            userId: userId,
            diff: JSON.parse(JSON.stringify({ status: "VOID", reason: "SYSTEM_VOID_FALLBACK", originalError: creationError.message }))
          }
        });

        return NextResponse.json(
          { error: "Invoice creation failed. A VOID stub record was created to preserve GST sequence integrity.", invoiceNumber },
          { status: 500 }
        );
      } catch (voidStubError: any) {
        // Double-failure log for manual reconciliation
        console.error(
          `[CRITICAL_COMPLIANCE_GAP] Failed to insert VOID stub for sequence ${invoiceNumber}. Manual reconciliation required!`,
          voidStubError
        );
        return NextResponse.json({ error: "Critical creation failure. Contact administrator." }, { status: 500 });
      }
    }
  } catch (error: any) {
    console.error("Failed to process POST /api/invoices:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, id: userId } = session.user;
    const { searchParams } = new URL(req.url);
    const requestedClientId = searchParams.get("clientId");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10)));

    let whereClause: any = {};

    if (role === "CLIENT") {
      // CLIENTs are strictly scoped to their own linked client — query param is ignored entirely
      const userClientId = (session.user as any).clientId;
      if (!userClientId) {
        return NextResponse.json({ error: "Forbidden: No client profile linked" }, { status: 403 });
      }
      whereClause = { clientId: userClientId };

    } else if (role === "ADMIN") {
      // ADMINs can see everything, optionally filtered by clientId param
      if (requestedClientId) whereClause = { clientId: requestedClientId };

    } else {
      // MANAGER / ACCOUNTANT / DATA_ENTRY: only see invoices for clients they are assigned to
      if (requestedClientId) {
        // Verify they're actually assigned to the requested client
        const assigned = await prisma.client.findFirst({
          where: { id: requestedClientId, assignedTo: { some: { id: userId } } }
        });
        if (!assigned) {
          return NextResponse.json({ error: "Forbidden: Not assigned to this client" }, { status: 403 });
        }
        whereClause = { clientId: requestedClientId };
      } else {
        // No clientId filter — scope to all their assigned clients
        whereClause = {
          client: { assignedTo: { some: { id: userId } } }
        };
      }
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
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.invoice.count({ where: whereClause }),
    ]);

    return NextResponse.json({ data: invoices, pagination: { page, pageSize, total } });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
