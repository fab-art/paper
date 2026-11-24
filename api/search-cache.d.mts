export type SearchCacheEntry<T> = { value: T; expiresAt: number };
export const SEARCH_CACHE_TTL_MS: number;
export const SEARCH_CACHE_MAX_ENTRIES: number;
export const DEFAULT_RETRY_AFTER_SECONDS: number;
export const MAX_RETRY_AFTER_SECONDS: number;
export function searchCacheKey(query: string, limit: number): string;
export function readSearchCache<T>(cache: Map<string, SearchCacheEntry<T>>, key: string, now?: number): T | null;
export function writeSearchCache<T>(cache: Map<string, SearchCacheEntry<T>>, key: string, value: T, now?: number): void;
export function retryAfterSeconds(header: string | null | undefined, now?: number): number;

export type RateLimitGate = {
  blockFor(seconds: number, now?: number): void;
  retryAfter(now?: number): number;
};
export function createRateLimitGate(): RateLimitGate;
