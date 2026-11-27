import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const rewriteSources = (config.rewrites ?? []).map(rule => rule.source);

test("SPA rewrites are explicit and cannot capture Vercel API routes", () => {
  assert.equal(rewriteSources.includes("/(.*)"), false, "a catch-all SPA rewrite shadows dynamic API routes");
  assert.equal(rewriteSources.includes("/:path*"), false, "a root wildcard can capture API routes");
  assert.ok(rewriteSources.includes("/"), "the Research Station root route must resolve to the SPA");
  assert.ok(rewriteSources.includes("/projects"), "the project library route must resolve to the SPA");
  assert.ok(rewriteSources.includes("/projects/:path*"), "direct project-detail routes must resolve to the SPA");
  for (const path of [
    "/blueprint", "/production", "/orchestration", "/literature", "/evidence",
    "/writing", "/data", "/systematic-reviews", "/quality", "/publication",
    "/collaboration", "/settings"
  ]) {
    assert.ok(rewriteSources.includes(path), `missing SPA rewrite for ${path}`);
  }
  assert.ok(rewriteSources.every(source => !source.startsWith("/api")), "API routes must be served by their Vercel functions");
});
