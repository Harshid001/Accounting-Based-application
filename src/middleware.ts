import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit, getClientIp, rateLimitHeaders, type RateLimitBucket } from "@/lib/rate-limit";
import { logger, getOrCreateRequestId, withRequestId } from "@/lib/logger";

const bucketByPath: Record<string, RateLimitBucket> = {
  "/api/auth": "auth",
  "/api/register": "registration",
  "/api/webhooks": "webhook",
};

function bucketFor(pathname: string): RateLimitBucket | null {
  for (const [prefix, bucket] of Object.entries(bucketByPath)) {
    if (pathname.startsWith(prefix)) return bucket;
  }
  if (pathname.startsWith("/api/")) return "api";
  if (pathname.startsWith("/dashboard") || pathname === "/") return "page";
  return null;
}

export async function middleware(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const log = logger.child({ requestId });
  const start = Date.now();

  const bucket = bucketFor(request.nextUrl.pathname);
  if (bucket) {
    const ip = getClientIp(request);
    const result = await rateLimit(bucket, ip);

    if (!result.success) {
      log.warn({ bucket, ip, path: request.nextUrl.pathname }, "rate limit exceeded");
      return withRequestId(
        new NextResponse(JSON.stringify({ error: "Too many requests" }), {
          status: 429,
          headers: { "Content-Type": "application/json", ...rateLimitHeaders(result) },
        }),
        requestId,
      );
    }
  }

  const response = NextResponse.next();
  withRequestId(response, requestId);

  const duration = Date.now() - start;
  if (duration > 500) {
    log.warn({ path: request.nextUrl.pathname, durationMs: duration }, "slow request");
  } else {
    log.debug({ path: request.nextUrl.pathname, durationMs: duration }, "request completed");
  }

  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.png$).*)",
  ],
};