import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { clearDatabase } from "./setup";
import { POST as createComment } from "../src/app/api/comments/route";
import { PATCH as patchComment, DELETE as deleteComment } from "../src/app/api/comments/[id]/route";

const prisma = new PrismaClient();

describe("Comments API", () => {
  let client: any;
  let adminUser: any;
  let accUser: any;
  let clientUser: any;
  let task: any;
  let doc: any;

  beforeAll(async () => {
    await clearDatabase();
    
    client = await prisma.client.create({ data: { name: "Test Client", type: "BUSINESS", status: "ACTIVE" } });
    
    // Create users
    adminUser = await prisma.user.create({ data: { email: "admin@test.com", role: "ADMIN" } });
    accUser = await prisma.user.create({ data: { email: "acc@test.com", role: "ACCOUNTANT" } });
    clientUser = await prisma.user.create({ data: { email: "client@test.com", role: "CLIENT", clientId: client.id } });
    
    // Assign accountant
    await prisma.client.update({
      where: { id: client.id },
      data: { assignedTo: { connect: { id: accUser.id } } }
    });

    // Create a Task (firm-level, no client)
    task = await prisma.task.create({ data: { title: "Internal Firm Task" } });
    
    // Create a Document (tied to client)
    doc = await prisma.document.create({
      data: { clientId: client.id, type: "PURCHASE_INVOICE", fileKey: "test", fileName: "test.pdf", uploadedById: adminUser.id }
    });
  });

  afterAll(async () => {
    await clearDatabase();
    await prisma.$disconnect();
  });

  it("should reject multiple parent FKs (CHECK constraint)", async () => {
    await expect(
      prisma.$executeRawUnsafe(`
        INSERT INTO "Comment" ("id", "content", "authorId", "taskId", "documentId", "updatedAt")
        VALUES ('comment_constraint_test', 'test', '${adminUser.id}', '${task.id}', '${doc.id}', NOW())
      `)
    ).rejects.toThrow(); // Should throw PrismaClientKnownRequestError for CHECK constraint violation
  });

  it("should block CLIENT from commenting on Task", async () => {
    const clientTaskReq = {
      json: async () => ({ content: "What is this task?", parentType: "task", parentId: task.id }),
      headers: new Headers({ "x-mock-role": "CLIENT", "x-mock-userid": clientUser.id })
    } as any;
    const clientTaskRes = await createComment(clientTaskReq);
    expect(clientTaskRes.status).toBe(403);
  });

  describe("Valid Comments and Mentions", () => {
    let createdComment: any;

    it("should create valid comment and notify mentioned users", async () => {
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
      expect(validCommentRes.status).toBe(201);
      createdComment = await validCommentRes.json();
      
      const notifs = await prisma.notification.findMany({ where: { recipientId: clientUser.id } });
      expect(notifs.length).toBe(1);
    });

    it("should strip mentions for unauthorized users", async () => {
      const notifsBefore = await prisma.notification.count({ where: { recipientId: clientUser.id } });
      
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
      expect(invalidMentionRes.status).toBe(201);
      
      const notifsAfter = await prisma.notification.count({ where: { recipientId: clientUser.id } });
      expect(notifsAfter).toBe(notifsBefore); // No new notification for client
    });

    it("should block admin from editing another user's comment", async () => {
      const editReqAdmin = {
        json: async () => ({ content: "Admin editing" }),
        headers: new Headers({ "x-mock-role": "ADMIN", "x-mock-userid": adminUser.id })
      } as any;
      const editResAdmin = await patchComment(editReqAdmin, { params: Promise.resolve({ id: createdComment.id }) } as any);
      expect(editResAdmin.status).toBe(403);
    });

    it("should allow author to edit their own comment", async () => {
      const editReqAcc = {
        json: async () => ({ content: "Accountant editing own" }),
        headers: new Headers({ "x-mock-role": "ACCOUNTANT", "x-mock-userid": accUser.id })
      } as any;
      const editResAcc = await patchComment(editReqAcc, { params: Promise.resolve({ id: createdComment.id }) } as any);
      expect(editResAcc.status).toBe(200);
    });

    it("should allow admin to delete another user's comment (Moderation) and log it", async () => {
      const deleteReqAdmin = {
        headers: new Headers({ "x-mock-role": "ADMIN", "x-mock-userid": adminUser.id })
      } as any;
      const deleteResAdmin = await deleteComment(deleteReqAdmin, { params: Promise.resolve({ id: createdComment.id }) } as any);
      expect(deleteResAdmin.status).toBe(200);
      
      const audit = await prisma.auditLog.findFirst({
        where: { entityType: "Comment", action: "DELETE", entityId: createdComment.id }
      });
      expect(audit).toBeTruthy();
    });
  });
});
