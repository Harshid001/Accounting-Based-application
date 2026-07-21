import { prisma } from "./prisma";

export async function validateEntityAccess(userId: string, role: string, parentType: string, parentId: string) {
  // 1. Identify which entity this is tied to
  let entityClientId: string | null = null;
  
  switch (parentType) {
    case "task": {
      const task = await prisma.task.findUnique({ where: { id: parentId } });
      if (!task) throw new Error("Parent entity not found");
      // CLIENT cannot ever see tasks
      if (role === "CLIENT") throw new Error("FORBIDDEN: Clients cannot access tasks");
      entityClientId = task.clientId;
      break;
    }
    case "client": {
      const client = await prisma.client.findUnique({ where: { id: parentId } });
      if (!client) throw new Error("Parent entity not found");
      // CLIENT can only access their own client entity (for messaging); not other clients' internal notes
      if (role === "CLIENT") {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.clientId !== parentId) {
          throw new Error("FORBIDDEN: Clients cannot access other client entities");
        }
        // Client is accessing their own entity — allowed for messaging
        return true;
      }
      entityClientId = client.id;
      break;
    }
    case "document": {
      const doc = await prisma.document.findUnique({ where: { id: parentId } });
      if (!doc) throw new Error("Parent entity not found");
      entityClientId = doc.clientId;
      break;
    }
    case "complianceItem": {
      const ci = await prisma.complianceItem.findUnique({ where: { id: parentId } });
      if (!ci) throw new Error("Parent entity not found");
      entityClientId = ci.clientId;
      break;
    }
    case "invoice": {
      const inv = await prisma.invoice.findUnique({ where: { id: parentId } });
      if (!inv) throw new Error("Parent entity not found");
      entityClientId = inv.clientId;
      break;
    }
    default:
      throw new Error("Invalid parent type");
  }

  // 2. Perform Scoping Checks
  if (role === "ADMIN" || role === "MANAGER") {
    return true; // Full access
  }

  if (role === "ACCOUNTANT" || role === "DATA_ENTRY") {
    if (!entityClientId) {
      // If the entity (like a general internal task) has no clientId, staff might still be able to access it if they are assigned. 
      // But typically we require client assignment for scope. Let's allow if they are assigned to the task, or just allow internal tasks.
      // Wait, in this AFMS architecture, internal tasks belong to the firm. We will allow them.
      return true;
    }
    const client = await prisma.client.findUnique({
      where: { id: entityClientId },
      include: { assignedTo: true }
    });
    if (!client || !client.assignedTo.some(u => u.id === userId)) {
      throw new Error("FORBIDDEN: Unauthorized for this client's entities");
    }
    return true;
  }

  if (role === "CLIENT") {
    // We already blocked task and client notes for CLIENT.
    // Ensure the entity they are accessing matches their own user's clientId
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.clientId !== entityClientId) {
      throw new Error("FORBIDDEN: Unauthorized to access other client entities");
    }
    return true;
  }

  throw new Error("FORBIDDEN: Role not recognized");
}

// Ensure mentions are valid IDs and also authorized to see this entity
export async function validateMentions(mentions: string[], parentType: string, parentId: string) {
  const validMentions = [];
  for (const uid of mentions) {
    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) continue; // User doesn't exist, ignore or throw? We'll ignore invalid tags.
    
    try {
      // Check if this mentioned user is actually allowed to see the entity
      await validateEntityAccess(user.id, user.role, parentType, parentId);
      validMentions.push(user.id);
    } catch (e) {
      // They can't see it, so they shouldn't be mentioned.
    }
  }
  return validMentions;
}
