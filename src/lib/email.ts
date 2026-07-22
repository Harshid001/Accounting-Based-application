/**
 * Email service abstraction.
 *
 * Uses Resend when RESEND_API_KEY is set; otherwise falls back to
 * console.log so development and CI work without credentials.
 *
 * To enable in production, install `resend` and set RESEND_API_KEY + EMAIL_FROM:
 *   npm install resend
 *   RESEND_API_KEY=re_xxxxx
 *   EMAIL_FROM=noreply@yourdomain.com
 */

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "AFMS <noreply@afms.app>";

  if (!apiKey) {
    // Dev/CI fallback — no real send
    console.log(`[EMAIL-DEV] To: ${to} | Subject: ${subject}`);
    console.log(`[EMAIL-DEV] Body preview: ${html.substring(0, 200)}...`);
    return;
  }

  try {
    // Dynamic import via variable to bypass TS static module resolution.
    // This is a standard pattern for optional dependencies.
    const moduleName = "resend";
    const resendModule = await import(/* webpackIgnore: true */ moduleName);
    const resend = new resendModule.Resend(apiKey);

    const { error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    if (error) {
      console.error(`[EMAIL] Resend API error for ${to}:`, error);
      throw new Error(`Email send failed: ${error.message}`);
    }
  } catch (err: any) {
    // If resend package is not installed, fall back to console
    if (err.code === "MODULE_NOT_FOUND" || err.code === "ERR_MODULE_NOT_FOUND") {
      console.warn("[EMAIL] 'resend' package not installed — falling back to console.log");
      console.log(`[EMAIL-FALLBACK] To: ${to} | Subject: ${subject}`);
      return;
    }
    throw err;
  }
}
