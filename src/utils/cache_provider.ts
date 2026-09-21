import { config } from "./config.js";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class CacheProvider<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxsize: number;
  private ttl: number;

  constructor(maxsize: number = config.CACHE_MAXSIZE, ttl: number = config.CACHE_TTL) {
    this.maxsize = maxsize;
    this.ttl = ttl;
  }

  get(key: string): T | undefined {
    if (!config.USE_CACHETOOLS) return undefined;
    
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.value;
  }

  set(key: string, value: T): void {
    if (!config.USE_CACHETOOLS) return;
    
    if (this.cache.size >= this.maxsize) {
      // Basic eviction: delete first key
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    
    this.cache.set(key, { value, expiresAt: Date.now() + (this.ttl * 1000) });
  }
}
