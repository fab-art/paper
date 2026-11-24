import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync(new URL("../frontend/src/components/Dashboard.tsx", import.meta.url), "utf8");
const authPanel = readFileSync(new URL("../frontend/src/components/AuthPanel.tsx", import.meta.url), "utf8");
const projectWorkspace = readFileSync(new URL("../frontend/src/components/ProjectWorkspace.tsx", import.meta.url), "utf8");

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

test("project list switcher uses toggle-group semantics", () => {
  assert.match(dashboard, /role=["']group["'] aria-label=["']Project lists["']/);
  assert.match(dashboard, /aria-pressed={scope === "active"}/);
  assert.doesNotMatch(dashboard, /role=["']tablist["']/);
});

test("sign-in method switcher uses toggle-group semantics", () => {
  assert.match(authPanel, /role=["']group["'] aria-label=["']Sign-in method["']/);
  assert.match(authPanel, /aria-pressed={mode === "magic"}/);
  assert.doesNotMatch(authPanel, /role=["']tablist["']/);
});

test("sign-in dialog keeps a document-level focus guard active during submission", () => {
  assert.match(authPanel, /document\.addEventListener\("keydown", handleDialogKeyDown, true\)/);
  assert.match(authPanel, /!dialog\.contains\(document\.activeElement\)/);
});

test("sign-in restores focus to a stable control after authentication", () => {
  assert.match(authPanel, /signedInControlRef/);
  assert.match(authPanel, /signInTriggerRef\.current \?\? signedInControlRef\.current/);
});

test("sign-out returns focus to the newly rendered sign-in button", () => {
  assert.match(authPanel, /wasSignedInRef/);
  assert.match(authPanel, /wasSignedInRef\.current && !session\?\.user/);
});

test("opening a project moves focus to its project-name control", () => {
  assert.match(projectWorkspace, /ref=\{projectNameRef\}/);
  assert.match(projectWorkspace, /projectNameRef\.current\?\.focus\(\)/);
});
