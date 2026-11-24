export const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
export const SEARCH_CACHE_MAX_ENTRIES = 100;
export const DEFAULT_RETRY_AFTER_SECONDS = 30;
export const MAX_RETRY_AFTER_SECONDS = 60 * 60;

export function searchCacheKey(query, limit) {
  const normalized = String(query || "").trim().toLocaleLowerCase().replace(/\\s+/g, " ");
  return normalized + "::" + Number(limit);
}

export function readSearchCache(cache, key, now = Date.now()) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    cache.delete(key);
    return null;
  }
  // Refresh insertion order so the Map behaves as a small LRU cache.
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}

export function writeSearchCache(cache, key, value, now = Date.now()) {
  cache.delete(key);
  cache.set(key, { value, expiresAt: now + SEARCH_CACHE_TTL_MS });
  while (cache.size > SEARCH_CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

export function retryAfterSeconds(header, now = Date.now()) {
  if (header === null || header === undefined || String(header).trim() === "") {
    return DEFAULT_RETRY_AFTER_SECONDS;
  }
  const value = String(header).trim();
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.min(MAX_RETRY_AFTER_SECONDS, Math.max(1, Math.ceil(seconds)));
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return DEFAULT_RETRY_AFTER_SECONDS;
  return Math.min(MAX_RETRY_AFTER_SECONDS, Math.max(1, Math.ceil((timestamp - now) / 1000)));
}
