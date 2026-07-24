import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { rateLimit, getClientIp, rateLimitHeaders, type RateLimitBucket } from "@/lib/rate-limit";
import { logger, getOrCreateRequestId, withRequestId } from "@/lib/logger";
import { getRedirectTarget } from "@/lib/middleware-logic";

const bucketByPath: Record<string, RateLimitBucket> = {
  "/api/auth/callback": "auth",
  "/api/auth/signin": "auth",
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

async function authMiddleware(request: NextRequest, token: any) {
  const { pathname } = request.nextUrl;
  const role = token?.role as string | undefined;

  const target = getRedirectTarget(pathname, role);

  if (target === "401") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (target) {
    const url = request.nextUrl.clone();
    url.pathname = target;
    url.search = "";
    if (request.headers.get("x-forwarded-proto") === "https") {
      url.protocol = "https:";
      url.port = "";
    }
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export default async function proxy(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const log = logger.child({ requestId });
  const start = Date.now();

  const rateLimitResponse = await rateLimitMiddleware(request);
  if (rateLimitResponse.status === 429) {
    log.warn({ path: request.nextUrl.pathname }, "rate limit exceeded");
    return withRequestId(rateLimitResponse, requestId);
  }

  // Get token directly to prevent next-auth's withAuth wrapper from applying
  // hidden automated redirects away from /login when a stale session exists.
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  const authResponse = await authMiddleware(request, token);
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
}

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/client-view/:path*",
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.png$).*)",
  ],
};