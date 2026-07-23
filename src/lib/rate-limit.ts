/**
 * Rate limiting with named buckets, backed by Redis (sliding window) when
 * configured, falling back to an in-memory sliding window otherwise.
 *
 * The in-memory fallback is per-process — fine for local dev, NOT sufficient
 * for a multi-instance production deployment (see redis.ts).
 *
 * Usage:
 *   import { rateLimit, getClientIp } from "@/lib/rate-limit";
 *   const ip = getClientIp(req);
 *   const result = await rateLimit("api", ip);
 *   if (!result.success) {
 *     return NextResponse.json({ error: "Too many requests" }, {
 *       status: 429,
 *       headers: rateLimitHeaders(result),
 *     });
 *   }
 */
import { Ratelimit } from "@upstash/ratelimit";
import { redis, isRedisConfigured } from "./redis";
import { logger } from "./logger";

export type RateLimitBucket = "api" | "page" | "auth" | "registration" | "webhook";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when the window resets. */
  reset: number;
}

interface BucketConfig {
  limit: number;
  windowMs: number;
  /** Upstash's duration string, e.g. "1 m", "15 m". */
  window: `${number} ${"ms" | "s" | "m" | "h" | "d"}`;
}

// Tune per route class. "auth" and "registration" are intentionally tight —
// they gate brute-force / spam-signup vectors, not normal traffic.
const BUCKETS: Record<RateLimitBucket, BucketConfig> = {
  api: { limit: 100, windowMs: 60_000, window: "1 m" },
  page: { limit: 300, windowMs: 60_000, window: "1 m" },
  auth: { limit: 10, windowMs: 15 * 60_000, window: "15 m" },
  registration: { limit: 5, windowMs: 15 * 60_000, window: "15 m" },
  webhook: { limit: 60, windowMs: 60_000, window: "1 m" },
};

// ---- Redis-backed limiters (one per bucket, created lazily) ----

const redisLimiters = new Map<RateLimitBucket, Ratelimit>();

function getRedisLimiter(bucket: RateLimitBucket): Ratelimit | null {
  if (!isRedisConfigured() || !redis) return null;
  let limiter = redisLimiters.get(bucket);
  if (!limiter) {
    const cfg = BUCKETS[bucket];
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(cfg.limit, cfg.window),
      prefix: `afms:ratelimit:${bucket}`,
      analytics: false,
    });
    redisLimiters.set(bucket, limiter);
  }
  return limiter;
}

// ---- In-memory fallback (per-process sliding window) ----

interface MemoryHit {
  timestamps: number[];
}

const memoryStore = new Map<string, MemoryHit>();

// Periodically sweep old entries so the map doesn't grow unbounded on a
// long-lived dev server.
let lastSweep = Date.now();
function sweepMemoryStore() {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  const maxWindow = Math.max(...Object.values(BUCKETS).map((b) => b.windowMs));
  for (const [key, hit] of memoryStore) {
    hit.timestamps = hit.timestamps.filter((t) => now - t < maxWindow);
    if (hit.timestamps.length === 0) memoryStore.delete(key);
  }
}

function memoryLimit(bucket: RateLimitBucket, identifier: string): RateLimitResult {
  sweepMemoryStore();
  const cfg = BUCKETS[bucket];
  const now = Date.now();
  const key = `${bucket}:${identifier}`;
  const hit = memoryStore.get(key) ?? { timestamps: [] };
  hit.timestamps = hit.timestamps.filter((t) => now - t < cfg.windowMs);

  const success = hit.timestamps.length < cfg.limit;
  if (success) hit.timestamps.push(now);
  memoryStore.set(key, hit);

  const oldestInWindow = hit.timestamps[0] ?? now;
  return {
    success,
    limit: cfg.limit,
    remaining: Math.max(0, cfg.limit - hit.timestamps.length),
    reset: oldestInWindow + cfg.windowMs,
  };
}

// ---- Public API ----

/**
 * Check + record a hit against `bucket` for `identifier` (usually an IP,
 * or `userId`/`email` for auth-style buckets). Never throws — a Redis error
 * fails open to the in-memory limiter rather than blocking the request.
 */
export async function rateLimit(bucket: RateLimitBucket, identifier: string): Promise<RateLimitResult> {
  const limiter = getRedisLimiter(bucket);
  if (limiter) {
    try {
      const { success, limit, remaining, reset } = await limiter.limit(identifier);
      if (!success) logger.warn({ bucket, identifier }, "rate limit exceeded");
      return { success, limit, remaining, reset };
    } catch (err) {
      logger.error({ err, bucket }, "Redis rate limiter failed, falling back to in-memory");
      return memoryLimit(bucket, identifier);
    }
  }
  const result = memoryLimit(bucket, identifier);
  if (!result.success) logger.warn({ bucket, identifier }, "rate limit exceeded (memory fallback)");
  return result;
}

/** Standard headers to attach to a 429 (or any rate-limited) response. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.reset / 1000)),
    ...(result.success ? {} : { "Retry-After": String(Math.max(0, Math.ceil((result.reset - Date.now()) / 1000))) }),
  };
}

/** Extract client IP from a standard Web Request (route handlers, middleware). */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

/**
 * Extract client IP from a plain headers record — for callers that don't have
 * a Web Request object, e.g. NextAuth's `authorize(credentials, req)`, where
 * `req.headers` is a plain `Record<string, string>` rather than a Headers
 * instance.
 */
export function getClientIpFromHeaders(headers: Record<string, string | string[] | undefined> | undefined): string {
  if (!headers) return "unknown";
  const raw = headers["x-forwarded-for"] ?? headers["X-Forwarded-For"];
  const forwarded = Array.isArray(raw) ? raw[0] : raw;
  if (forwarded) return forwarded.split(",")[0].trim();
  const realRaw = headers["x-real-ip"] ?? headers["X-Real-Ip"];
  const real = Array.isArray(realRaw) ? realRaw[0] : realRaw;
  return real || "unknown";
}
