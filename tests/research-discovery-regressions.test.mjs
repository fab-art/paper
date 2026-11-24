import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync(new URL("../api/search-papers.ts", import.meta.url), "utf8");
const discovery = readFileSync(new URL("../frontend/src/components/ResearchDiscovery.tsx", import.meta.url), "utf8");

test("Semantic Scholar handler applies an instance cooldown after HTTP 429", () => {
  assert.match(api, /rateLimitGate\.retryAfter\(\)/);
  assert.match(api, /rateLimitGate\.blockFor\(retrySeconds\)/);
  assert.match(api, /res\.setHeader\("Retry-After"/);
});

test("discovery explains when search history could not be persisted", () => {
  assert.match(discovery, /noticeIsWarning/);
  assert.match(discovery, /Recent-search history could not be saved:/);
  assert.match(discovery, /rd-notice \$\{noticeIsWarning \? "warning" : ""\}/);
});
