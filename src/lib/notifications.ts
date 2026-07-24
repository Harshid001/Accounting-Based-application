import { Notification, User, ComplianceItem } from "@prisma/client";
import { sendEmail } from "./email";

/**
 * Escapes HTML special characters to prevent XSS in email clients.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
      await sendComplianceEmail(recipient.email, notification, contextItem);
    } catch (err) {
      console.error(`Failed to send email to ${recipient.email}:`, err);
    }
  }

  // 2. Capacitor / FCM Push Notification (Mobile)
  // DEFERRED: Wiring up real push requires adding an `fcmToken` field to the
  // User model and configuring Firebase Admin SDK credentials — deferred to a
  // dedicated push-notification sprint to keep this diff focused on
  // performance + existing integration completion.
  //
  // When implemented:
  //   - Add `fcmToken String?` to User model
  //   - Install firebase-admin, configure service account
  //   - Use firebaseAdmin.messaging().send({ token, notification: { ... } })
  try {
    console.log(`[PUSH-STUB] Server-side FCM push for user ${recipient.id} would trigger here.`);
  } catch (err) {
    console.error(`Failed to send Capacitor push to ${recipient.id}:`, err);
  }

  // 3. Electron Desktop Notification
  // Architecture Fix: A server route cannot trigger an OS notification on a user's desktop directly.
  // The correct design is that this cron job ONLY writes the Notification to the database (which happens upstream),
  // and the Electron app polls or subscribes to a WebSocket/SSE for unread notifications,
  // triggering the OS notification client-side. No server-side "sendElectronNotification" is needed.
}

async function sendComplianceEmail(email: string, notification: Notification, item: ComplianceItem) {
  const safeType = escapeHtml(String(item.type));
  const safeDueDate = escapeHtml(item.dueDate.toLocaleDateString());
  const safeStatus = escapeHtml(String(item.status));
  const safeNotes = item.notes ? escapeHtml(item.notes) : null;

  const subject = `AFMS — Compliance Deadline: ${item.type}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Compliance Deadline Approaching</h2>
      <p>A <strong>${safeType}</strong> compliance item is due on
         <strong>${safeDueDate}</strong>.</p>
      <p>Current status: <strong>${safeStatus}</strong></p>
      ${safeNotes ? `<p>Notes: ${safeNotes}</p>` : ""}
      <hr style="border: none; border-top: 1px solid #eee;" />
      <p style="color: #666; font-size: 12px;">
        This is an automated notification from AFMS. Please log in to take action.
      </p>
    </div>
  `;

  await sendEmail({ to: email, subject, html });
}

