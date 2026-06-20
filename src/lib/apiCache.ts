export const DEFAULT_API_CACHE_TTL_MS = 30_000;

interface CacheEntry<T> {
  expiresAt: number;
  promise: Promise<T>;
}

export function createPromiseCache<T>(ttlMs: number = DEFAULT_API_CACHE_TTL_MS) {
  const cache = new Map<string, CacheEntry<T>>();

  return {
    get(key: string, fetcher: () => Promise<T>): Promise<T> {
      const now = Date.now();
      const entry = cache.get(key);
      if (entry && entry.expiresAt > now) {
        return entry.promise;
      }

      const promise = fetcher().catch((error) => {
        if (cache.get(key)?.promise === promise) {
          cache.delete(key);
        }
        throw error;
      });
      cache.set(key, { expiresAt: now + ttlMs, promise });
      return promise;
    },
    invalidate(key?: string) {
      if (key) {
        cache.delete(key);
      } else {
        cache.clear();
      }
    },
  };
}
