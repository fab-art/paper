import test from "node:test";
import assert from "node:assert/strict";
import {
  searchCacheKey,
  readSearchCache,
  writeSearchCache,
  retryAfterSeconds
} from "../api/search-cache.mjs";

test("normalizes equivalent queries into one cache key", () => {
  assert.equal(searchCacheKey("  Diabetes   care ", 12), searchCacheKey("diabetes care", 12));
  assert.notEqual(searchCacheKey("diabetes care", 6), searchCacheKey("diabetes care", 12));
});

test("returns cached results until the ten-minute TTL expires", () => {
  const cache = new Map();
  const value = [{ title: "A paper" }];
  writeSearchCache(cache, "query", value, 1000);
  assert.deepEqual(readSearchCache(cache, "query", 1000 + 599999), value);
  assert.equal(readSearchCache(cache, "query", 1000 + 600000), null);
  assert.equal(cache.has("query"), false);
});

test("evicts least-recently-used entries when the cache reaches its bound", () => {
  const cache = new Map();
  for (let i = 0; i < 100; i++) writeSearchCache(cache, String(i), [i], 1000);
  readSearchCache(cache, "0", 1001);
  writeSearchCache(cache, "100", [100], 1002);
  assert.equal(cache.size, 100);
  assert.deepEqual(readSearchCache(cache, "0", 1003), [0]);
  assert.equal(readSearchCache(cache, "1", 1003), null);
});

test("parses Retry-After seconds and HTTP-date values safely", () => {
  assert.equal(retryAfterSeconds("45", 0), 45);
  assert.equal(retryAfterSeconds("0", 0), 1);
  assert.equal(retryAfterSeconds("invalid", 0), 30);
  assert.equal(retryAfterSeconds(null, 0), 30);
  assert.equal(retryAfterSeconds(new Date(60000).toUTCString(), 0), 60);
});
