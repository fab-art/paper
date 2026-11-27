import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { normalizeEnginePath } from "../api/engine/path.mjs";

test("normalizes Vercel catch-all path values to the final endpoint segment", () => {
  assert.equal(normalizeEnginePath("health"), "health");
  assert.equal(normalizeEnginePath(["health"]), "health");
  assert.equal(normalizeEnginePath(["engine", "health"]), "health");
  assert.equal(normalizeEnginePath("engine/health"), "health");
  assert.equal(normalizeEnginePath(undefined), "");
  assert.equal(normalizeEnginePath([]), "");
});

test("uses a supported single-segment Vercel dynamic function filename", () => {
  assert.equal(existsSync(new URL("../api/engine/[path].ts", import.meta.url)), true);
  assert.equal(existsSync(new URL("../api/engine/[...path].ts", import.meta.url)), false);
});
