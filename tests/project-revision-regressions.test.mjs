import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertProjectRevision, PROJECT_CONFLICT_MESSAGE } from "../frontend/src/lib/project-revision-guard.mjs";
import { projectFingerprint, shouldSaveProjectSnapshot } from "../frontend/src/lib/project-save-guard.mjs";

const dbSource = readFileSync(new URL("../frontend/src/lib/db.ts", import.meta.url), "utf8");
const typesSource = readFileSync(new URL("../frontend/src/lib/types.ts", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../frontend/src/components/Dashboard.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../frontend/src/components/ProjectWorkspace.tsx", import.meta.url), "utf8");
const studio = readFileSync(new URL("../frontend/src/components/Studio.tsx", import.meta.url), "utf8");

function functionSource(name) {
  const start = dbSource.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `Missing database function: ${name}`);
  const end = dbSource.indexOf("\nexport async function", start + 1);
  return dbSource.slice(start, end === -1 ? dbSource.length : end);
}

test("revision guard permits a write when the loaded revision is current", () => {
  assert.doesNotThrow(() => assertProjectRevision(4, 4));
  assert.equal(PROJECT_CONFLICT_MESSAGE.includes("another tab"), true);
});

test("revision guard rejects a stale write instead of overwriting newer project data", () => {
  assert.throws(() => assertProjectRevision(4, 5), /updated in another tab/);
});

test("Project records carry an optional backward-compatible revision", () => {
  assert.match(typesSource, /revision\?: number/);
});

test("saveProject captures the snapshot revision before waiting on IndexedDB", () => {
  const source = functionSource("saveProject");
  const expectedAt = source.indexOf("const expectedRevision = project.revision ?? 0;");
  const transactionAt = source.indexOf("await db.transaction");
  assert.ok(expectedAt >= 0 && expectedAt < transactionAt);
  assert.match(source, /assertProjectRevision\(expectedRevision, actualRevision\)/);
  assert.match(source, /revision: actualRevision \+ 1/);
  assert.match(source, /return savedProject/);
});

test("restoreProject captures its revision before waiting on IndexedDB", () => {
  const source = functionSource("restoreProject");
  const expectedAt = source.indexOf("const expectedRevision = project.revision ?? 0;");
  const transactionAt = source.indexOf("await db.transaction");
  assert.ok(expectedAt >= 0 && expectedAt < transactionAt);
  assert.match(source, /assertProjectRevision\(expectedRevision, actualRevision\)/);
  assert.match(source, /revision: actualRevision \+ 1/);
  assert.match(source, /return restoredProject/);
});

test("project fingerprints ignore persistence metadata but detect content changes", () => {
  const first = { id: "p1", name: "Protocol", revision: 1, updatedAt: 100 };
  const saved = { id: "p1", name: "Protocol", revision: 2, updatedAt: 200 };
  const edited = { id: "p1", name: "Updated protocol", revision: 2, updatedAt: 200 };
  assert.equal(projectFingerprint(first), projectFingerprint(saved));
  assert.notEqual(projectFingerprint(saved), projectFingerprint(edited));
});

test("stale debounce snapshots are skipped while the current project remains saveable", () => {
  const stale = { id: "p1", name: "Old title", revision: 1 };
  const current = { id: "p1", name: "New title", revision: 2 };
  assert.equal(shouldSaveProjectSnapshot(stale, current, ""), false);
  assert.equal(shouldSaveProjectSnapshot(current, current, ""), true);
  assert.equal(shouldSaveProjectSnapshot(current, current, projectFingerprint(current)), false);
});

test("permanent deletion checks the revision shown in the dashboard", () => {
  const source = functionSource("deleteProjectAndData");
  assert.match(source, /expectedRevision/);
  assert.match(source, /assertProjectRevision/);
  assert.match(dashboard, /deleteProjectAndData\(project\.id, project\.revision \?\? 0\)/);
});

test("dashboard reports stale archive, restore, and delete actions instead of leaking rejections", () => {
  assert.match(dashboard, /const \[actionError, setActionError\] = useState\("?"\)/);
  assert.match(dashboard, /role=["']alert["'][^>]*className=["']dash-action-error/);
  assert.match(dashboard, /Could not archive project/);
  assert.match(dashboard, /Could not restore project/);
  assert.match(dashboard, /Could not delete project/);
});

test("ProjectWorkspace offers a confirmed reload after a cross-tab revision conflict", () => {
  assert.match(workspace, /reloadLatestProject/);
  assert.match(workspace, /window\.confirm\(/);
  assert.match(workspace, /Load latest saved version/);
  assert.match(workspace, /notice\.includes\("updated in another tab"\)/);
});

test("Studio offers a confirmed reload after a cross-tab revision conflict", () => {
  assert.match(studio, /reloadLatestProject/);
  assert.match(studio, /window\.confirm\(/);
  assert.match(studio, /Reload latest/);
  assert.match(studio, /notice\.includes\("updated in another tab"\)/);
});

test("workspace autosaves route through the stale-snapshot guard and persist returned revisions", () => {
  assert.match(workspace, /persistProject\(project\)/);
  assert.match(workspace, /lastSavedFingerprintRef/);
  assert.match(workspace, /revision: saved\.revision/);
  assert.match(studio, /persistProject\(project\)/);
  assert.match(studio, /lastSavedFingerprintRef/);
  assert.match(studio, /revision: saved\.revision/);
});

test("best-effort workspace cleanup saves do not create unhandled rejections", () => {
  assert.match(workspace, /void saveProject\(latest\)\.catch\(\(\) => undefined\)/);
  assert.match(studio, /void saveProject\(latest\)\.catch\(\(\) => undefined\)/);
});
