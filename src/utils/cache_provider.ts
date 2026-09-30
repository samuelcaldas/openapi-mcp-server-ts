import { config } from "./config.js";
import { logger } from "./logger.js";

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * In-memory cache provider with TTL and LRU eviction support.
 * Mirrors the Python SOT cache provider.
 */
export class CacheProvider<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxsize: number;
  private ttl: number;

  constructor(maxsize: number = config.CACHE_MAXSIZE || 1000, ttl: number = config.CACHE_TTL || 3600) {
    this.maxsize = maxsize;
    this.ttl = ttl;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      logger.debug(`Cache expired for key: ${key}`);
      return undefined;
    }

    // Refresh position for LRU tracking
    this.cache.delete(key);
    this.cache.set(key, entry);
    logger.debug(`Cache hit for key: ${key}`);
    return entry.value;
  }

  set(key: string, value: T, customTtlSeconds?: number): void {
    const ttlSeconds = customTtlSeconds !== undefined ? customTtlSeconds : this.ttl;
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxsize) {
      // Evict oldest inserted/accessed entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
        logger.debug(`Cache evicted oldest key: ${oldestKey}`);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    logger.debug(`Cache set for key: ${key} (ttl: ${ttlSeconds}s)`);
  }

  invalidate(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) logger.debug(`Cache invalidated: ${key}`);
    return deleted;
  }

  clear(): void {
    const count = this.cache.size;
    this.cache.clear();
    logger.debug(`Cache cleared (${count} entries removed)`);
  }

  cleanup(): number {
    const now = Date.now();
    let expiredCount = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        expiredCount++;
      }
    }
    if (expiredCount > 0) {
      logger.debug(`Cache cleanup removed ${expiredCount} expired entries`);
    }
    return expiredCount;
  }

  get size(): number {
    return this.cache.size;
  }
}

export const defaultCacheProvider = new CacheProvider();

/**
 * Decorates / wraps an async function with LRU caching and TTL.
 */
export function cached<Args extends unknown[], ReturnType>(
  fn: (...args: Args) => Promise<ReturnType>,
  ttlSeconds = 3600,
  cache = defaultCacheProvider,
): (...args: Args) => Promise<ReturnType> {
  return async (...args: Args): Promise<ReturnType> => {
    const key = `${fn.name || "fn"}:${JSON.stringify(args)}`;
    const hit = cache.get(key) as ReturnType | undefined;
    if (hit !== undefined) return hit;

    const result = await fn(...args);
    cache.set(key, result, ttlSeconds);
    return result;
  };
}
