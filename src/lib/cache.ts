/**
 * TTL cache with tag-based invalidation.
 *
 * Backed by Redis (shared across all instances) when UPSTASH_REDIS_REST_URL /
 * UPSTASH_REDIS_REST_TOKEN are set; falls back to an in-memory Map otherwise
 * (single-instance only — see redis.ts for the consequences of that in prod).
 *
 * The public interface matches the original in-memory-only version, except
 * every method is now async (Redis is a network call).
 *
 * Usage:
 *   import { appCache } from "@/lib/cache";
 *   await appCache.set("services:all", data, 300_000, ["services"]);
 *   const cached = await appCache.get("services:all");
 *   await appCache.invalidateByTag("services"); // called on mutation
 */
import { redis, isRedisConfigured } from "./redis";
import { logger } from "./logger";

const KEY_PREFIX = "afms:cache:";
const TAG_PREFIX = "afms:cache:tag:";
// Tag-index sets outlive individual cache-entry TTLs so invalidateByTag can
// still find (and no-op delete) a key that already expired on its own; this
// TTL just bounds how long an orphaned tag set can linger in Redis.
const TAG_INDEX_TTL_SECONDS = 24 * 60 * 60;

interface MemoryEntry<T = unknown> {
  value: T;
  expiresAt: number;
  tags: string[];
}

class AppCache {
  // ---- in-memory fallback state (used when Redis isn't configured) ----
  private memStore = new Map<string, MemoryEntry>();
  private memTagIndex = new Map<string, Set<string>>();
  private readonly maxMemSize: number;

  constructor(maxMemSize = 500) {
    this.maxMemSize = maxMemSize;
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    if (isRedisConfigured() && redis) {
      try {
        const value = await redis.get<T>(KEY_PREFIX + key);
        return value === null ? undefined : value;
      } catch (err) {
        logger.error({ err, key }, "cache.get: Redis error, treating as miss");
        return undefined;
      }
    }
    return this.memGet<T>(key);
  }

  async set<T = unknown>(key: string, value: T, ttlMs: number, tags: string[] = []): Promise<void> {
    if (isRedisConfigured() && redis) {
      try {
        const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
        await redis.set<T>(KEY_PREFIX + key, value, { ex: ttlSeconds });
        if (tags.length > 0) {
          await Promise.all(
            tags.map(async (tag) => {
              await redis!.sadd(TAG_PREFIX + tag, key);
              await redis!.expire(TAG_PREFIX + tag, TAG_INDEX_TTL_SECONDS);
            })
          );
        }
        return;
      } catch (err) {
        logger.error({ err, key }, "cache.set: Redis error, falling back to in-memory for this entry");
        // fall through — best-effort in-memory write so the request path
        // that called set() still gets *a* cache, just not a shared one
      }
    }
    this.memSet(key, value, ttlMs, tags);
  }

  async invalidateByTag(tag: string): Promise<void> {
    if (isRedisConfigured() && redis) {
      try {
        const keys = await redis.smembers(TAG_PREFIX + tag);
        if (keys.length > 0) {
          await redis.del(...keys.map((k) => KEY_PREFIX + k));
        }
        await redis.del(TAG_PREFIX + tag);
      } catch (err) {
        logger.error({ err, tag }, "cache.invalidateByTag: Redis error");
      }
    }
    // Also clear the in-memory side — harmless no-op if Redis is the active
    // backend and nothing was ever written there for this tag.
    this.memInvalidateByTag(tag);
  }

  async clear(): Promise<void> {
    if (isRedisConfigured() && redis) {
      logger.warn(
        "cache.clear() intentionally does not wipe Redis (afms:cache:* keys may be " +
          "shared with other tooling) — use invalidateByTag() instead. Clearing in-memory fallback only."
      );
    }
    this.memStore.clear();
    this.memTagIndex.clear();
  }

  // ---- in-memory implementation (same logic as the original cache.ts) ----

  private memGet<T>(key: string): T | undefined {
    const entry = this.memStore.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.memDelete(key);
      return undefined;
    }
    return entry.value as T;
  }

  private memSet<T>(key: string, value: T, ttlMs: number, tags: string[]): void {
    if (this.memStore.size >= this.maxMemSize && !this.memStore.has(key)) {
      const oldestKey = this.memStore.keys().next().value;
      if (oldestKey !== undefined) this.memDelete(oldestKey);
    }
    this.memStore.set(key, { value, expiresAt: Date.now() + ttlMs, tags });
    for (const tag of tags) {
      if (!this.memTagIndex.has(tag)) this.memTagIndex.set(tag, new Set());
      this.memTagIndex.get(tag)!.add(key);
    }
  }

  private memInvalidateByTag(tag: string): void {
    const keys = this.memTagIndex.get(tag);
    if (!keys) return;
    for (const key of keys) this.memDelete(key);
    this.memTagIndex.delete(tag);
  }

  private memDelete(key: string): void {
    const entry = this.memStore.get(key);
    if (entry) {
      for (const tag of entry.tags) {
        this.memTagIndex.get(tag)?.delete(key);
        if (this.memTagIndex.get(tag)?.size === 0) this.memTagIndex.delete(tag);
      }
      this.memStore.delete(key);
    }
  }
}

// Singleton instance — survives across requests in the same Node.js process
// (and, when Redis is configured, is additionally shared across processes).
const globalForCache = globalThis as unknown as { __appCache: AppCache | undefined };
export const appCache = globalForCache.__appCache ?? new AppCache();
globalForCache.__appCache = appCache;
