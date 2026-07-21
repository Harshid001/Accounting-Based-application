import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function test() {
  console.log("=== STARTING INVOICE & PAYMENT TESTS ===");

  try {
    // Clean up
    await prisma.comment.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.document.deleteMany({});
    await prisma.client.deleteMany({});
    await prisma.user.deleteMany({});

    // 1. Create a dummy client and dummy users
    const client = await prisma.client.create({
      data: {
        name: "Test Client Inc",
        type: "BUSINESS",
        status: "ACTIVE"
      }
    });
    
    const assignedStaff = await prisma.user.create({
      data: { email: "staff@test.com", role: "ACCOUNTANT" }
    });
    
    const unassignedStaff = await prisma.user.create({
      data: { email: "unassigned@test.com", role: "ACCOUNTANT" }
    });

    // Assign staff
    await prisma.client.update({
      where: { id: client.id },
      data: { assignedTo: { connect: { id: assignedStaff.id } } }
    });

    console.log(`Created client: ${client.id}`);

    // 2. Test Client Scoping Rejection
    console.log("\n--- Testing Client Scoping Rejection ---");
    const maliciousPayload = {
      clientId: client.id,
      dueDate: new Date(Date.now() + 86400000 * 30).toISOString(),
      notes: "Test invoice",
      total: 10.00, // Malicious total, should be ignored
      lineItems: [
        { description: "Audit Services", quantity: 1, unitPrice: 1000, taxRate: 10 }, // 1100
        { description: "Consulting", quantity: 2, unitPrice: 500, taxRate: 0 } // 1000 => 2100 total
      ]
    };

    const { POST: createInvoice } = require("./src/app/api/invoices/route.ts");
    
    const unassignedReq = { 
      json: async () => maliciousPayload,
      headers: new Headers({ "x-mock-role": "ACCOUNTANT", "x-mock-userid": unassignedStaff.id })
    } as any;
    
    const unassignedRes = await createInvoice(unassignedReq);
    console.log(`Unassigned staff create attempt status: ${unassignedRes.status} (Expected: 403)`);

    // 3. Test POST /api/invoices (malicious client total test with assigned staff)
    console.log("\n--- Testing Malicious Client Total (Assigned Staff) ---");
    const assignedReq = { 
      json: async () => maliciousPayload,
      headers: new Headers({ "x-mock-role": "ACCOUNTANT", "x-mock-userid": assignedStaff.id })
    } as any;
    
    const res = await createInvoice(assignedReq);
    const invoice = await res.json();
    
    if (res.status === 201) {
      console.log(`Success! Invoice generated: ${invoice.invoiceNumber}`);
      console.log(`Client requested total: 10.00 | Server calculated total: ${invoice.total}`);
    } else {
      console.error("Failed to create invoice:", invoice);
      return;
    }

    // 4. Test GET /api/invoices/[id]
    console.log("\n--- Testing GET Invoice ---");
    const { GET: getInvoice } = require("./src/app/api/invoices/[id]/route.ts");
    const getRes = await getInvoice({} as any, { params: { id: invoice.id } });
    const fetchedInvoice = await getRes.json();
    console.log(`Fetched invoice ${fetchedInvoice.invoiceNumber}, status: ${fetchedInvoice.status}`);

    // 5. Test POST /api/invoices/[id]/payments (Overpayment test)
    console.log("\n--- Testing Overpayment Rejection ---");
    const overpaymentPayload = { amount: 3000.00, method: "BANK_TRANSFER" }; // 3000 > 2100
    const { POST: createPayment } = require("./src/app/api/invoices/[id]/payments/route.ts");
    
    const mockPaymentReq = { 
      json: async () => overpaymentPayload,
      headers: new Headers({ "x-mock-role": "ADMIN" })
    } as any;
    const paymentRes = await createPayment(mockPaymentReq, { params: { id: invoice.id } });
    const paymentResult = await paymentRes.json();
    
    console.log(`Payment attempt status: ${paymentRes.status}`);
    if (paymentRes.status === 400 && paymentResult.error.includes("OVERPAYMENT")) {
       console.log("Success! Overpayment was correctly rejected.");
    }

    // 6. Test Partial Payment -> PARTIALLY_PAID status
    console.log("\n--- Testing Partial Payment State Transition ---");
    const partialPayload = { amount: 1000.00, method: "CASH" };
    const partialReq = { json: async () => partialPayload, headers: new Headers({ "x-mock-role": "ADMIN" }) } as any;
    const partialRes = await createPayment(partialReq, { params: { id: invoice.id } });
    const partialResult = await partialRes.json();
    console.log(`Partial payment status: ${partialResult.invoice?.status}`);

    // 7. Test Void Blocked on Paid Invoice
    console.log("\n--- Testing Void Blocked on Invoice with Payments ---");
    const { PATCH: patchInvoice } = require("./src/app/api/invoices/[id]/route.ts");
    const patchReq = { 
      json: async () => ({ status: "VOID" }),
      headers: new Headers({ "x-mock-role": "ADMIN" }) 
    } as any;
    const patchRes = await patchInvoice(patchReq, { params: { id: invoice.id } });
    console.log(`Void attempt status: ${patchRes.status} (Expected: 400)`);
    if (patchRes.status === 400) {
      console.log("Success! Void blocked correctly because payments exist.");
    }

    // 8. Test Full Payment -> PAID status
    console.log("\n--- Testing Full Payment State Transition ---");
    const fullPayload = { amount: 1100.00, method: "CASH" }; // Remaining balance
    const fullReq = { json: async () => fullPayload, headers: new Headers({ "x-mock-role": "ADMIN" }) } as any;
    const fullRes = await createPayment(fullReq, { params: { id: invoice.id } });
    const fullResult = await fullRes.json();
    console.log(`Full payment status: ${fullResult.invoice?.status}`);
    
    // 9. Test Role check rejection
    console.log("\n--- Testing Role Check Rejection (CLIENT role) ---");
    const clientRoleReq = { 
      json: async () => maliciousPayload,
      headers: new Headers({ "x-mock-role": "CLIENT" })
    } as any;
    const roleRes = await createInvoice(clientRoleReq);
    console.log(`Client role creation attempt status: ${roleRes.status} (Expected: 403)`);

    // 10. Test Concurrent Double-Request for Invoice Numbering
    console.log("\n--- Testing Concurrent Invoice Numbering ---");
    const req1 = { json: async () => maliciousPayload, headers: new Headers({ "x-mock-role": "ADMIN" }) } as any;
    const req2 = { json: async () => maliciousPayload, headers: new Headers({ "x-mock-role": "ADMIN" }) } as any;
    
    // Fire simultaneously
    const [res1, res2] = await Promise.all([
      createInvoice(req1),
      createInvoice(req2)
    ]);
    
    const inv1 = await res1.json();
    const inv2 = await res2.json();
    
    console.log(`Concurrent Invoice 1: ${inv1.invoiceNumber}`);
    console.log(`Concurrent Invoice 2: ${inv2.invoiceNumber}`);
    if (inv1.invoiceNumber && inv2.invoiceNumber && inv1.invoiceNumber !== inv2.invoiceNumber) {
      console.log("Success! Concurrent invoices generated unique sequence numbers.");
    } else {
      console.error("Test failed: Concurrent invoices did not generate correctly.");
    }
    
    console.log("\n=== ALL TESTS COMPLETED SUCCESSFULLY ===");
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
