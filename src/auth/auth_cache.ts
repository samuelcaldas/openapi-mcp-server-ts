interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TokenCache<T = unknown> {
  private readonly cache = new Map<string, CacheEntry<T>>();

  constructor(private readonly maxSize = 100, private readonly ttlSeconds = 300) {}

  get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;
    if (Date.now() >= item.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return item.value;
  }

  set(key: string, value: T, ttlSeconds = this.ttlSeconds): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldest = [...this.cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
      if (oldest) this.cache.delete(oldest[0]);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.cache) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
}

const globalTokenCache = new TokenCache();

export function getTokenCache(): TokenCache {
  return globalTokenCache;
}

export function cachedAuthData<T extends (...args: any[]) => any>(ttlSeconds = 300): (fn: T) => T {
  return (fn: T) => {
    return ((...args: Parameters<T>) => {
      const key = `${fn.name}:${args.map(String).join(":")}`;
      const cached = globalTokenCache.get(key);
      if (cached !== undefined) return cached;
      const value = fn(...args);
      globalTokenCache.set(key, value, ttlSeconds);
      return value;
    }) as T;
  };
}
