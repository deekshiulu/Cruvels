/**
 * Client-Side In-Memory & Session Cache for Zero-Latency Navigation
 * Implements Stale-While-Revalidate (SWR) caching pattern.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class ClientCacheManager {
  private memoryStore: Map<string, CacheEntry<any>> = new Map();
  private maxAgeMs = 60 * 1000;
  private userScope = '';

  public setUserScope(userId: string) {
    if (this.userScope && this.userScope !== userId) {
      this.invalidate();
    }
    this.userScope = userId || '';
  }

  private getKey(prefix: string, params?: Record<string, any>): string {
    const scope = this.userScope || 'anon';
    if (!params) return `${scope}:${prefix}`;
    return `${scope}:${prefix}:${JSON.stringify(params)}`;
  }

  public get<T>(prefix: string, params?: Record<string, any>): T | null {
    const key = this.getKey(prefix, params);
    const entry = this.memoryStore.get(key);
    if (entry && Date.now() - entry.timestamp < this.maxAgeMs) {
      return entry.data as T;
    }

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const raw = sessionStorage.getItem(`cruvels_cache_${key}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Date.now() - parsed.timestamp < this.maxAgeMs) {
            this.memoryStore.set(key, parsed);
            return parsed.data as T;
          }
        }
      } catch {}
    }

    return null;
  }

  public set<T>(prefix: string, params: Record<string, any> | undefined, data: T): void {
    const key = this.getKey(prefix, params);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    this.memoryStore.set(key, entry);

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.setItem(`cruvels_cache_${key}`, JSON.stringify(entry));
      } catch {}
    }
  }

  public invalidate(prefix?: string): void {
    if (!prefix) {
      this.memoryStore.clear();
      if (typeof window !== 'undefined' && window.sessionStorage) {
        Object.keys(sessionStorage).forEach((k) => {
          if (k.startsWith('cruvels_cache_')) sessionStorage.removeItem(k);
        });
      }
      return;
    }

    const scopedPrefix = `${this.userScope || 'anon'}:${prefix}`;
    for (const key of this.memoryStore.keys()) {
      if (key.startsWith(scopedPrefix) || key.startsWith(prefix)) {
        this.memoryStore.delete(key);
      }
    }

    if (typeof window !== 'undefined' && window.sessionStorage) {
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith(`cruvels_cache_${scopedPrefix}`) || k.startsWith(`cruvels_cache_${prefix}`)) {
          sessionStorage.removeItem(k);
        }
      });
    }
  }
}

export const clientCache = new ClientCacheManager();
