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

    let count = 0;
    const OFFSETS = [7, 3, 1];
    const msInDay = 24 * 60 * 60 * 1000;
    
    for (const item of upcomingItems) {
      // Calculate how many days left until due date
      const daysLeft = Math.ceil((item.dueDate.getTime() - Date.now()) / msInDay);
      
      // Determine which offset applies (exact match, or falling within the window)
      // e.g., if daysLeft is 6, we've missed the 7-day exact mark, but we should trigger the 7-day notification if we haven't already.
      const currentOffset = OFFSETS.find(o => daysLeft <= o);
      
      if (!currentOffset) continue;

      // Find stakeholders: assigned staff + client users
      const recipients = [...item.client.assignedTo, ...item.client.clientUsers];
      
      for (const recipient of recipients) {
        // Unique constraint dedup check based on triggerOffset
        const existing = await prisma.notification.findFirst({
          where: {
            recipientId: recipient.id,
            relatedComplianceItemId: item.id,
            type: "COMPLIANCE_DEADLINE",
            triggerOffset: currentOffset
          }
        });

        if (!existing) {
          // Send notification (Email + App Push)
          const notification = await prisma.notification.create({
            data: {
              recipientId: recipient.id,
              type: "COMPLIANCE_DEADLINE",
              relatedComplianceItemId: item.id,
              channel: "EMAIL",
              triggerOffset: currentOffset
            }
          });

          await deliverNotification(notification, recipient, item);
          
          await prisma.notification.update({
            where: { id: notification.id },
            data: { sentAt: new Date() }
          });
          
          count++;
        }
      }
    }

    return NextResponse.json({ success: true, processed: count });
  } catch (error) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
