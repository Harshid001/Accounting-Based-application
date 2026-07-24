import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach } from "vitest";
import { PrismaClient, type Client, type User, type Task, type Document } from "@prisma/client";
import type { NextRequest } from "next/server";
import { clearDatabase, setMockSession, clearMockSession } from "./setup";
import { POST as createComment } from "../src/app/api/comments/route";
import { PATCH as patchComment, DELETE as deleteComment } from "../src/app/api/comments/[id]/route";

const prisma = new PrismaClient();

type IdParams = { params: Promise<{ id: string }> };

describe("Comments API", () => {
  let client: Client;
  let adminUser: User;
  let accUser: User;
  let clientUser: User;
  let task: Task;
  let doc: Document;

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

  afterEach(() => {
    clearMockSession();
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
    ).rejects.toThrow();
  });

  it("should reject unauthenticated comment creation (401)", async () => {
    setMockSession(null);
    const req = {
      json: async () => ({ content: "anon", parentType: "task", parentId: task.id }),
      headers: new Headers({}),
      url: "http://localhost/api/comments"
    } as unknown as NextRequest;
    const res = await createComment(req);
    expect(res.status).toBe(401);
  });

  it("should block CLIENT from commenting on Task", async () => {
    setMockSession({ user: { id: clientUser.id, role: "CLIENT", clientId: client.id } });
    const clientTaskReq = {
      json: async () => ({ content: "What is this task?", parentType: "task", parentId: task.id }),
      headers: new Headers({}),
      url: "http://localhost/api/comments"
    } as unknown as NextRequest;
    const clientTaskRes = await createComment(clientTaskReq);
    expect(clientTaskRes.status).toBe(403);
  });

  describe("Valid Comments and Mentions", () => {
    let createdComment: { id: string };

    it("should create valid comment and notify mentioned users", async () => {
      setMockSession({ user: { id: accUser.id, role: "ACCOUNTANT" } });
      const validCommentReq = {
        json: async () => ({ 
          content: "Please review this document @client", 
          parentType: "document", 
          parentId: doc.id,
          mentions: [clientUser.id, "clqzzzzzzzzzzzzzzzzzzzzzz"] 
        }),
        headers: new Headers({}),
        url: "http://localhost/api/comments"
      } as unknown as NextRequest;
      
      const validCommentRes = await createComment(validCommentReq);
      console.log(await validCommentRes.clone().json().catch(async () => await validCommentRes.clone().text()));
      expect(validCommentRes.status).toBe(201);
      createdComment = await validCommentRes.json();
      
      const notifs = await prisma.notification.findMany({ where: { recipientId: clientUser.id } });
      expect(notifs.length).toBe(1);
    });

    it("should strip mentions for unauthorized users", async () => {
      const notifsBefore = await prisma.notification.count({ where: { recipientId: clientUser.id } });
      
      setMockSession({ user: { id: adminUser.id, role: "ADMIN" } });
      const invalidMentionReq = {
        json: async () => ({ 
          content: "Hey @client look at this internal task", 
          parentType: "task", 
          parentId: task.id,
          mentions: [clientUser.id] // Client can't see Task!
        }),
        headers: new Headers({})
      } as unknown as NextRequest;
      
      const invalidMentionRes = await createComment(invalidMentionReq);
      expect(invalidMentionRes.status).toBe(201);
      
      const notifsAfter = await prisma.notification.count({ where: { recipientId: clientUser.id } });
      expect(notifsAfter).toBe(notifsBefore); // No new notification for client
    });

    it("should block admin from editing another user's comment", async () => {
      setMockSession({ user: { id: adminUser.id, role: "ADMIN" } });
      const editReqAdmin = {
        json: async () => ({ content: "Admin editing" }),
        headers: new Headers({}),
        url: `http://localhost:3000/api/comments/${createdComment.id}`,
      } as unknown as NextRequest;
      const editResAdmin = await patchComment(editReqAdmin);
      expect(editResAdmin.status).toBe(403);
    });

    it("should allow author to edit their own comment", async () => {
      setMockSession({ user: { id: accUser.id, role: "ACCOUNTANT" } });
      const editReqAcc = {
        json: async () => ({ content: "Accountant editing own" }),
        headers: new Headers({}),
        url: `http://localhost:3000/api/comments/${createdComment.id}`,
      } as unknown as NextRequest;
      const editResAcc = await patchComment(editReqAcc);
      expect(editResAcc.status).toBe(200);
    });

    it("should allow admin to delete another user's comment (Moderation) and log it", async () => {
      setMockSession({ user: { id: adminUser.id, role: "ADMIN" } });
      const deleteReqAdmin = {
        headers: new Headers({}),
        url: `http://localhost:3000/api/comments/${createdComment.id}`,
      } as unknown as NextRequest;
      const deleteResAdmin = await deleteComment(deleteReqAdmin);
      expect(deleteResAdmin.status).toBe(200);
      
      const audit = await prisma.auditLog.findFirst({
        where: { entityType: "Comment", action: "DELETE", entityId: createdComment.id }
      });
      expect(audit).toBeTruthy();
    });
  });
});
