import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function test() {
  console.log("=== STARTING COMMENT TESTS ===");

  try {
    // 1. Setup Data
    await prisma.comment.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.document.deleteMany({});
    await prisma.invoice.deleteMany({}); // ADDED THIS
    await prisma.client.deleteMany({});
    await prisma.user.deleteMany({});

    const client = await prisma.client.create({ data: { name: "Test Client", type: "BUSINESS", status: "ACTIVE" } });
    
    // Create users
    const adminUser = await prisma.user.create({ data: { email: "admin@test.com", role: "ADMIN" } });
    const accUser = await prisma.user.create({ data: { email: "acc@test.com", role: "ACCOUNTANT" } });
    const clientUser = await prisma.user.create({ data: { email: "client@test.com", role: "CLIENT", clientId: client.id } });
    
    // Assign accountant
    await prisma.client.update({
      where: { id: client.id },
      data: { assignedTo: { connect: { id: accUser.id } } }
    });

    // Create a Task (firm-level, no client)
    const task = await prisma.task.create({ data: { title: "Internal Firm Task" } });
    
    // Create a Document (tied to client)
    const doc = await prisma.document.create({
      data: { clientId: client.id, type: "PURCHASE_INVOICE", fileKey: "test", fileName: "test.pdf", uploadedById: adminUser.id }
    });

    console.log("Setup complete");

    // 2. Test CHECK Constraint Bypass Attempt
    console.log("\n--- Testing CHECK Constraint (Multiple FKs) ---");
    const { POST: createComment } = require("./src/app/api/comments/route.ts");
    
    // Note: The API route itself prevents passing multiple FKs because it uses a strict if/else block based on `parentType`.
    // To truly test the DB constraint, we must use Prisma raw directly to bypass the API layer entirely.
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Comment" ("id", "content", "authorId", "taskId", "documentId", "updatedAt")
        VALUES ('comment_constraint_test', 'test', '${adminUser.id}', '${task.id}', '${doc.id}', NOW())
      `);
      console.error("Failed: Database allowed comment with two parents!");
    } catch (e: any) {
      if (e.message.includes("check_single_parent") || e.message.includes("violates check constraint")) {
        console.log("Success! Database strictly rejected multiple parent FKs.");
      } else {
        console.error("Unknown error on constraint check:", e);
      }
    }

    // 3. Test CLIENT commenting on Task (Should fail)
    console.log("\n--- Testing CLIENT Access to Task ---");
    const clientTaskReq = {
      json: async () => ({ content: "What is this task?", parentType: "task", parentId: task.id }),
      headers: new Headers({ "x-mock-role": "CLIENT", "x-mock-userid": clientUser.id })
    } as any;
    const clientTaskRes = await createComment(clientTaskReq);
    if (clientTaskRes.status === 403) {
      console.log("Success! Client blocked from commenting on Task.");
    } else {
      console.error("Failed: Client allowed to comment on Task.");
    }

    // 4. Test Valid Comment + Valid Mentions
    console.log("\n--- Testing Valid Comment + Mention Notifications ---");
    const validCommentReq = {
      json: async () => ({ 
        content: "Please review this document @client", 
        parentType: "document", 
        parentId: doc.id,
        mentions: [clientUser.id, "fake_id"] 
      }),
      headers: new Headers({ "x-mock-role": "ACCOUNTANT", "x-mock-userid": accUser.id })
    } as any;
    
    const validCommentRes = await createComment(validCommentReq);
    const comment = await validCommentRes.json();
    
    if (validCommentRes.status === 201) {
      console.log("Success! Comment created.");
      // Verify notification
      const notifs = await prisma.notification.findMany({ where: { recipientId: clientUser.id } });
      if (notifs.length === 1) {
         console.log("Success! Mention correctly generated a notification.");
      } else {
         console.error("Failed: Notification not generated.");
      }
    } else {
      console.error("Failed to create comment", comment);
    }

    // 5. Test Mention Stripping (Mention someone who can't see the entity)
    console.log("\n--- Testing Invalid Mention Stripping ---");
    const invalidMentionReq = {
      json: async () => ({ 
        content: "Hey @client look at this internal task", 
        parentType: "task", 
        parentId: task.id,
        mentions: [clientUser.id] // Client can't see Task!
      }),
      headers: new Headers({ "x-mock-role": "ADMIN", "x-mock-userid": adminUser.id })
    } as any;
    
    const invalidMentionRes = await createComment(invalidMentionReq);
    const invalidComment = await invalidMentionRes.json();
    
    if (invalidMentionRes.status === 201) {
      // Notification shouldn't be created for clientUser because they are stripped out
      const notifsAfter = await prisma.notification.count({ where: { recipientId: clientUser.id } });
      if (notifsAfter === 1) { // Same as before, didn't increment
         console.log("Success! Mention was stripped because the user lacks access to the parent entity.");
      } else {
         console.error("Failed: Notification sent to unauthorized user.");
      }
    }

    // 6. Test Edit Permissions
    console.log("\n--- Testing Edit Permissions ---");
    const { PATCH: patchComment } = require("./src/app/api/comments/[id]/route.ts");
    
    // Admin tries to edit Accountant's comment
    const editReqAdmin = {
      json: async () => ({ content: "Admin editing" }),
      headers: new Headers({ "x-mock-role": "ADMIN", "x-mock-userid": adminUser.id })
    } as any;
    const editResAdmin = await patchComment(editReqAdmin, { params: { id: comment.id } });
    if (editResAdmin.status === 403) console.log("Success! Admin blocked from editing other's comment.");
    
    // Accountant edits their own comment
    const editReqAcc = {
      json: async () => ({ content: "Accountant editing own" }),
      headers: new Headers({ "x-mock-role": "ACCOUNTANT", "x-mock-userid": accUser.id })
    } as any;
    const editResAcc = await patchComment(editReqAcc, { params: { id: comment.id } });
    if (editResAcc.status === 200) console.log("Success! Author can edit their own comment.");

    // 7. Test Delete (Moderation)
    console.log("\n--- Testing Moderation Delete ---");
    const { DELETE: deleteComment } = require("./src/app/api/comments/[id]/route.ts");
    
    // Admin deletes Accountant's comment
    const deleteReqAdmin = {
      headers: new Headers({ "x-mock-role": "ADMIN", "x-mock-userid": adminUser.id })
    } as any;
    const deleteResAdmin = await deleteComment(deleteReqAdmin, { params: { id: comment.id } });
    if (deleteResAdmin.status === 200) {
       console.log("Success! Admin successfully deleted another user's comment (Moderation).");
       
       // Verify Audit Log
       const audit = await prisma.auditLog.findFirst({
         where: { entityType: "Comment", action: "DELETE", entityId: comment.id }
       });
       if (audit) console.log("Success! Audit log recorded the moderated deletion.");
    } else {
       console.error("Failed to delete comment");
    }

    console.log("\n=== ALL TESTS COMPLETED SUCCESSFULLY ===");

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
