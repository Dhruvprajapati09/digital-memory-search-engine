import { env } from "../../config/env";

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const resultCache = new Map<string, CacheEntry<unknown>>();
const suggestionCache = new Map<string, CacheEntry<unknown>>();

function isCacheEnabled(): boolean {
  return env.ENABLE_SEARCH_CACHE !== false;
}

function getFromCache<T>(store: Map<string, CacheEntry<unknown>>, key: string): T | undefined {
  if (!isCacheEnabled()) return undefined;
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function setCache<T>(
  store: Map<string, CacheEntry<unknown>>,
  key: string,
  value: T,
  ttlMs: number
): void {
  if (!isCacheEnabled() || ttlMs <= 0) return;
  store.set(key, {
    expiresAt: Date.now() + ttlMs,
    value,
  });
}

export function buildSearchCacheKey(
  userId: string,
  payload: Record<string, unknown>
): string {
  return JSON.stringify({
    userId,
    ...payload,
  });
}

export function getCachedSearchResult<T>(key: string): T | undefined {
  return getFromCache<T>(resultCache, key);
}

export function setCachedSearchResult<T>(key: string, value: T): void {
  setCache(resultCache, key, value, env.SEARCH_RESULT_CACHE_TTL_MS);
}

export function getCachedSuggestions<T>(key: string): T | undefined {
  return getFromCache<T>(suggestionCache, key);
}

export function setCachedSuggestions<T>(key: string, value: T): void {
  setCache(suggestionCache, key, value, env.SEARCH_SUGGESTION_CACHE_TTL_MS);
}

export function getSearchCacheStats(): {
  resultEntries: number;
  suggestionEntries: number;
  backend: "memory";
  redisConfigured: boolean;
} {
  return {
    resultEntries: resultCache.size,
    suggestionEntries: suggestionCache.size,
    backend: "memory",
    redisConfigured: Boolean(env.REDIS_URL),
  };
}

export function clearSearchV2Caches(): void {
  resultCache.clear();
  suggestionCache.clear();
}
