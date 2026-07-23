/**
 * Structured logging via Pino.
 *
 * - JSON logs in production (Vercel/CloudWatch friendly), pretty-printed in dev.
 * - Automatic redaction of secrets (passwords, tokens, auth headers, cookies).
 * - Request-ID correlation: call `getOrCreateRequestId(req)` once per request,
 *   then `logger.child({ requestId })` (or use `createRequestLogger`) so every
 *   log line for that request can be grepped/joined together.
 *
 * Usage:
 *   import { logger, createRequestLogger } from "@/lib/logger";
 *   logger.info({ userId }, "user logged in");
 *
 *   // per-request:
 *   const log = createRequestLogger(requestId);
 *   log.error({ err }, "[InvoiceCreationError] failed to create invoice");
 */
import pino from "pino";
import { randomUUID } from "crypto";

const isProd = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

const REDACT_PATHS = [
  "password",
  "*.password",
  "*.*.password",
  "newPassword",
  "*.newPassword",
  "currentPassword",
  "*.currentPassword",
  "token",
  "*.token",
  "*.*.token",
  "accessToken",
  "*.accessToken",
  "refreshToken",
  "*.refreshToken",
  "idToken",
  "*.idToken",
  "secret",
  "*.secret",
  "apiKey",
  "*.apiKey",
  "tokenHash",
  "*.tokenHash",
  "authorization",
  "*.authorization",
  "headers.authorization",
  "*.headers.authorization",
  "cookie",
  "*.cookie",
  "headers.cookie",
  "*.headers.cookie",
  "set-cookie",
  "*.set-cookie",
  "req.headers.authorization",
  "req.headers.cookie",
];

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
  enabled: !isTest,
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: { service: "afms" },
  transport:
    !isProd && !isTest
      ? {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname,service" },
        }
      : undefined,
});

/** Get the incoming request ID (if a proxy/load balancer set one) or mint a new one. */
export function getOrCreateRequestId(req: Request): string {
  return req.headers.get("x-request-id") || randomUUID();
}

/** Child logger pre-bound with a requestId so related log lines can be correlated. */
export function createRequestLogger(requestId: string, extra: Record<string, unknown> = {}) {
  return logger.child({ requestId, ...extra });
}

/** Attach the request ID to an outgoing NextResponse (or any Response) for client-side correlation. */
export function withRequestId<T extends Response>(response: T, requestId: string): T {
  response.headers.set("x-request-id", requestId);
  return response;
}
