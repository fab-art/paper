import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync(new URL("../frontend/src/components/Dashboard.tsx", import.meta.url), "utf8");
const authPanel = readFileSync(new URL("../frontend/src/components/AuthPanel.tsx", import.meta.url), "utf8");

test("project search has an explicit accessible name", () => {
  assert.match(dashboard, /<input[^>]*aria-label=["']Search projects["']/s);
});

test("create-project overlay exposes a named, described modal dialog", () => {
  assert.match(dashboard, /role=["']dialog["']/);
  assert.match(dashboard, /aria-modal={true}/);
  assert.match(dashboard, /aria-labelledby=["']dash-create-title["']/);
  assert.match(dashboard, /aria-describedby=["']dash-create-description["']/);
});

test("create-project dialog supports Escape and keeps keyboard focus inside", () => {
  assert.match(dashboard, /event\.key\s*===?\s*["']Escape["']/);
  assert.match(dashboard, /event\.key\s*!==\s*["']Tab["']/);
  assert.match(dashboard, /document\.activeElement/);
  assert.match(dashboard, /\.focus\(\)/);
});

test("sign-in dialog has a programmatic description", () => {
  assert.match(authPanel, /aria-describedby=["']cloud-auth-description["']/);
  assert.match(authPanel, /id=["']cloud-auth-description["']/);
});

test("sign-in dialog supports Escape and keeps keyboard focus inside", () => {
  assert.match(authPanel, /event\.key\s*===?\s*["']Escape["']/);
  assert.match(authPanel, /event\.key\s*!==\s*["']Tab["']/);
  assert.match(authPanel, /document\.activeElement/);
  assert.match(authPanel, /\.focus\(\)/);
});

test("closing either dialog restores focus to its opener", () => {
  assert.match(dashboard, /createTriggerRef\.current\?\.focus\(\)/);
  assert.match(authPanel, /signInTriggerRef\.current\?\.focus\(\)/);
});
