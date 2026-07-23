/**
 * Shared Upstash Redis client (REST-based — works from serverless/edge, no
 * persistent TCP connection needed).
 *
 * If UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN aren't set (e.g. local
 * dev without Redis provisioned), `redis` is null and callers (cache.ts,
 * rate-limit.ts) fall back to in-memory behavior. This means the app degrades
 * gracefully locally but MUST have these vars set in any multi-instance
 * deployment, or caching/rate-limiting silently stop being shared across
 * instances.
 */
import { Redis } from "@upstash/redis";
import { logger } from "./logger";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

function createClient(): Redis | null {
  if (!url || !token) {
    if (process.env.NODE_ENV === "production") {
      logger.warn(
        "UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set in production — " +
          "cache and rate limiting are falling back to per-instance memory, which will " +
          "NOT be consistent across multiple server instances."
      );
    }
    return null;
  }
  return new Redis({ url, token });
}

const globalForRedis = globalThis as unknown as { __redisClient: Redis | null | undefined };

export const redis = globalForRedis.__redisClient !== undefined ? globalForRedis.__redisClient : createClient();
globalForRedis.__redisClient = redis;

export function isRedisConfigured(): boolean {
  return redis !== null;
}
