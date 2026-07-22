import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deliverNotification } from "@/lib/notifications";

export async function GET(request: Request) {
  try {
    // SECURITY GUARD: Authenticate cron requests via CRON_SECRET to prevent external abuse
    const authHeader = request.headers.get("authorization");
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
    }

    // Process logic: find due compliance items that need notifications
    const upcomingItems = await prisma.complianceItem.findMany({
      where: {
        status: { notIn: ["FILED", "ACKNOWLEDGED"] },
        dueDate: {
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
          gte: new Date()
        }
      },
      include: {
        client: {
          include: {
            assignedTo: true,
            clientUsers: true
          }
        }
      }
    });

    if (upcomingItems.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    // N+1 FIX: Batch-fetch ALL existing notifications for these compliance items
    // instead of checking one-by-one inside the loop.
    const complianceItemIds = upcomingItems.map(item => item.id);
    const existingNotifications = await prisma.notification.findMany({
      where: {
        relatedComplianceItemId: { in: complianceItemIds },
        type: "COMPLIANCE_DEADLINE",
      },
      select: {
        recipientId: true,
        relatedComplianceItemId: true,
        triggerOffset: true,
      },
    });

    // Build a lookup set for O(1) dedup: "recipientId:complianceItemId:offset"
    const existingSet = new Set(
      existingNotifications.map(
        n => `${n.recipientId}:${n.relatedComplianceItemId}:${n.triggerOffset}`
      )
    );

    let count = 0;
    const OFFSETS = [7, 3, 1];
    const msInDay = 24 * 60 * 60 * 1000;

    // Collect all notifications to create in one batch
    const toCreate: Array<{
      recipientId: string;
      relatedComplianceItemId: string;
      triggerOffset: number;
      // Keep references for delivery
      _recipientRef: typeof upcomingItems[0]["client"]["assignedTo"][0];
      _itemRef: typeof upcomingItems[0];
    }> = [];

    for (const item of upcomingItems) {
      const daysLeft = Math.ceil((item.dueDate.getTime() - Date.now()) / msInDay);
      const currentOffset = OFFSETS.find(o => daysLeft <= o);
      if (!currentOffset) continue;

      const recipients = [...item.client.assignedTo, ...item.client.clientUsers];

      for (const recipient of recipients) {
        const key = `${recipient.id}:${item.id}:${currentOffset}`;
        if (!existingSet.has(key)) {
          toCreate.push({
            recipientId: recipient.id,
            relatedComplianceItemId: item.id,
            triggerOffset: currentOffset,
            _recipientRef: recipient,
            _itemRef: item,
          });
          // Add to set so we don't create duplicates within this batch
          existingSet.add(key);
        }
      }
    }

    // Batch-create all new notifications
    if (toCreate.length > 0) {
      await prisma.notification.createMany({
        data: toCreate.map(n => ({
          recipientId: n.recipientId,
          type: "COMPLIANCE_DEADLINE" as const,
          relatedComplianceItemId: n.relatedComplianceItemId,
          channel: "EMAIL" as const,
          triggerOffset: n.triggerOffset,
        })),
        skipDuplicates: true, // Safety net for @@unique constraint race
      });

      // Fetch the created notifications back to get IDs for delivery + sentAt update
      const createdNotifications = await prisma.notification.findMany({
        where: {
          relatedComplianceItemId: { in: complianceItemIds },
          type: "COMPLIANCE_DEADLINE",
          sentAt: null, // Only unsent ones
        },
      });

      // Deliver each notification (email/push) and mark as sent
      const sentIds: string[] = [];
      for (const notification of createdNotifications) {
        const ref = toCreate.find(
          t => t.recipientId === notification.recipientId &&
               t.relatedComplianceItemId === notification.relatedComplianceItemId &&
               t.triggerOffset === notification.triggerOffset
        );
        if (ref) {
          await deliverNotification(notification, ref._recipientRef, ref._itemRef);
          sentIds.push(notification.id);
          count++;
        }
      }

      // Batch-update sentAt
      if (sentIds.length > 0) {
        await prisma.notification.updateMany({
          where: { id: { in: sentIds } },
          data: { sentAt: new Date() },
        });
      }
    }

    return NextResponse.json({ success: true, processed: count });
  } catch (error) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
