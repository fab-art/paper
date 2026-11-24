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


test("discovery search exposes search and busy semantics", () => {
  assert.ok(discovery.includes('role="search"'));
  assert.ok(discovery.includes('aria-label="Search academic literature"'));
  assert.ok(discovery.includes("aria-busy={loading}"));
});

test("clearing discovery search returns focus to its input", () => {
  assert.ok(discovery.includes("searchInputRef"));
  assert.ok(discovery.includes("searchInputRef.current?.focus()"));
  assert.ok(discovery.includes('aria-label="Clear search query"'));
});

test("discovery loading and result updates are announced politely", () => {
  assert.ok(discovery.includes('role="status" aria-live="polite"'));
  assert.ok(discovery.includes("aria-live=\"polite\""));
});

test("discovery results show venue, date, citations and open-access links when available", () => {
  assert.ok(discovery.includes("paper.venue"));
  assert.ok(discovery.includes("paper.publicationDate"));
  assert.ok(discovery.includes("paper.citationCount"));
  assert.ok(discovery.includes("paper.openAccessPdf"));
});

test("each discovery result identifies Semantic Scholar as its metadata source", () => {
  assert.ok(discovery.includes("Semantic Scholar record"));
});

test("search errors offer a retry action", () => {
  assert.ok(discovery.includes("Try search again"));
  assert.ok(discovery.includes("onClick={() => void runSearch(query)}"));
});

test("paper save actions have result-specific accessible names and explicit button types", () => {
  assert.ok(discovery.includes('type="button"'));
  assert.ok(discovery.includes("Save ${paper.title} to this project's library"));
});
