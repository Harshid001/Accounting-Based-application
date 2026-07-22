/**
 * Lightweight in-memory cache with TTL and tag-based invalidation.
 * No external dependency required — suitable for single-instance Next.js deployments.
 *
 * Usage:
 *   import { appCache } from "@/lib/cache";
 *   appCache.set("services:all", data, 300_000, ["services"]);
 *   const cached = appCache.get("services:all");
 *   appCache.invalidateByTag("services"); // called on mutation
 */

interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
  tags: string[];
}

class AppCache {
  private store = new Map<string, CacheEntry>();
  private tagIndex = new Map<string, Set<string>>(); // tag → set of keys
  private readonly maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  get<T = unknown>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T = unknown>(key: string, value: T, ttlMs: number, tags: string[] = []): void {
    // Evict oldest if at capacity
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.delete(oldestKey);
      }
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      tags,
    });

    // Update tag index
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  /** Invalidate all cache entries associated with the given tag. */
  invalidateByTag(tag: string): void {
    const keys = this.tagIndex.get(tag);
    if (!keys) return;
    for (const key of keys) {
      this.delete(key);
    }
    this.tagIndex.delete(tag);
  }

  /** Delete a single entry and clean up its tag references. */
  private delete(key: string): void {
    const entry = this.store.get(key);
    if (entry) {
      for (const tag of entry.tags) {
        this.tagIndex.get(tag)?.delete(key);
        if (this.tagIndex.get(tag)?.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
      this.store.delete(key);
    }
  }

  /** Flush the entire cache. */
  clear(): void {
    this.store.clear();
    this.tagIndex.clear();
  }
}

// Singleton instance — survives across requests in the same Node.js process
const globalForCache = globalThis as unknown as { __appCache: AppCache | undefined };
export const appCache = globalForCache.__appCache ?? new AppCache();
globalForCache.__appCache = appCache;
