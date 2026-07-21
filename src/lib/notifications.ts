import { Notification, User, ComplianceItem } from "@prisma/client";

/**
 * Delivers a notification via the configured channels (Email, Push, In-App).
 * This service ensures channels are kept separate and explicitly handled.
 */
export async function deliverNotification(
  notification: Notification,
  recipient: User,
  contextItem: ComplianceItem
) {
  // 1. Email Delivery
  if (recipient.email) {
    try {
      await sendEmail(recipient.email, notification, contextItem);
    } catch (err) {
      console.error(`Failed to send email to ${recipient.email}:`, err);
    }
  }

  // 2. Capacitor Push Notification (Mobile)
  try {
    await sendCapacitorPush(recipient, notification, contextItem);
  } catch (err) {
    console.error(`Failed to send Capacitor push to ${recipient.id}:`, err);
  }

  // 3. Electron Desktop Notification
  // Architecture Fix: A server route cannot trigger an OS notification on a user's desktop directly.
  // The correct design is that this cron job ONLY writes the Notification to the database (which happens upstream),
  // and the Electron app polls or subscribes to a WebSocket/SSE for unread notifications,
  // triggering the OS notification client-side. No server-side "sendElectronNotification" is needed.
}

async function sendEmail(email: string, notification: Notification, item: ComplianceItem) {
  // In a real implementation, this would use Resend, SendGrid, or AWS SES.
  // e.g., await resend.emails.send({ to: email, subject: "Deadline", html: "..." })
  console.log(`[EMAIL] Sent to ${email}: Compliance Deadline for ${item.type} (Due: ${item.dueDate})`);
}

async function sendCapacitorPush(user: User, notification: Notification, item: ComplianceItem) {
  // Architecture Fix: A cron route cannot call Capacitor client APIs.
  // This requires device token registration (e.g., adding `fcmToken` to the User model)
  // and using a server-side Push SDK (like Firebase Admin SDK) to send the payload.
  
  // if (!user.fcmToken) return;
  // await firebaseAdmin.messaging().send({
  //   token: user.fcmToken,
  //   notification: { title: "Deadline Approaching", body: `Compliance ${item.type} is due soon.` }
  // });
  
  console.log(`[PUSH] Stub: Server-side FCM push for user ${user.id} would trigger here.`);
}
