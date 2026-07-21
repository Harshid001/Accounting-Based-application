import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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
    const userRole = req.headers.get("x-mock-role") || "ADMIN"; // TODO: get from auth session
    if (!["ADMIN", "MANAGER", "ACCOUNTANT"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { clientId, serviceSubscriptionId, dueDate, notes, lineItems } = body;

    if (!clientId || !lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Client scoping check
    const userId = req.headers.get("x-mock-userid") || "dummy_user";
    if (userRole !== "ADMIN") {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        include: { assignedTo: true }
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

    // 2. Wrap everything in a transaction, except the invoice number which we generate just prior safely 
    // Since generateInvoiceNumber is atomic, we get a guaranteed unique sequence number.
    // If the creation transaction fails, there WILL be a gap. 
    // To strictly avoid gaps, we must do the counter increment inside the main transaction.
    
    // Let's implement the strictly gapless version using $transaction with a retry loop
    const maxRetries = 3;
    let result;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        result = await prisma.$transaction(async (tx) => {
          // a. Atomic upsert to get the sequence inside the transaction
          // This holds a row-level lock on the counter until transaction ends
          const counter = await tx.invoiceCounter.upsert({
            where: { id: year },
            create: { id: year, seq: 1 },
            update: { seq: { increment: 1 } },
          });
          
          const invoiceNumber = `INV-${year}-${String(counter.seq).padStart(4, "0")}`;

          // b. Create the invoice
          const invoice = await tx.invoice.create({
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

          // c. Audit Log
          await tx.auditLog.create({
            data: {
              entityType: "Invoice",
              entityId: invoice.id,
              action: "CREATE",
              userId: "system", // TODO: from session
              diff: JSON.parse(JSON.stringify(invoice))
            }
          });

          return invoice;
        });
        
        // Break out of retry loop on success
        break;
      } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < maxRetries) {
          // Wait briefly before retrying the transaction to handle the year-boundary race
          await new Promise(res => setTimeout(res, 50 * attempt));
          continue;
        }
        throw error;
      }
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create invoice:", error);
    
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
       return NextResponse.json({ error: "Concurrent creation error, please try again" }, { status: 409 });
    }
    
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    
    const whereClause = clientId ? { clientId } : {};
    
    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      include: {
        client: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    
    return NextResponse.json(invoices);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
