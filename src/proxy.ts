import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withAuth } from "next-auth/middleware";
import { rateLimit, getClientIp, rateLimitHeaders, type RateLimitBucket } from "@/lib/rate-limit";
import { logger, getOrCreateRequestId, withRequestId } from "@/lib/logger";
import { getRedirectTarget } from "@/lib/middleware-logic";

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

async function rateLimitMiddleware(request: NextRequest) {
  const bucket = bucketFor(request.nextUrl.pathname);
  if (bucket) {
    const ip = getClientIp(request);
    const result = await rateLimit(bucket, ip);

    if (!result.success) {
      return new NextResponse(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { "Content-Type": "application/json", ...rateLimitHeaders(result) },
      });
    }
  }
  return NextResponse.next();
}

async function authMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role = (request as unknown as { nextauth?: { token?: { role?: string } } }).nextauth?.token?.role as string | undefined;

  const target = getRedirectTarget(pathname, role);

  if (target === "401") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (target) {
    const url = request.nextUrl.clone();
    url.pathname = target;
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export default withAuth(
  async function middleware(request: NextRequest) {
    const requestId = getOrCreateRequestId(request);
    const log = logger.child({ requestId });
    const start = Date.now();

    const rateLimitResponse = await rateLimitMiddleware(request);
    if (rateLimitResponse.status === 429) {
      log.warn({ path: request.nextUrl.pathname }, "rate limit exceeded");
      return withRequestId(rateLimitResponse, requestId);
    }

    const authResponse = await authMiddleware(request);
    if (authResponse.status !== 200) {
      return withRequestId(authResponse, requestId);
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
  },
  {
    callbacks: {
      authorized: () => true,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/client-view/:path*",
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.png$).*)",
  ],
};