import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertProjectRevision, PROJECT_CONFLICT_MESSAGE } from "../frontend/src/lib/project-revision-guard.mjs";

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

test("saveProject compares the last known revision and increments it atomically", () => {
  const source = functionSource("saveProject");
  assert.match(source, /knownProjectRevisions/);
  assert.match(source, /assertProjectRevision/);
  assert.match(source, /revision: actualRevision \+ 1/);
});

test("loadProject and listProjects refresh the per-tab revision baseline", () => {
  assert.match(functionSource("loadProject"), /knownProjectRevisions\.set/);
  assert.match(functionSource("listProjects"), /knownProjectRevisions\.set/);
});

test("restoreProject refuses to restore a stale project snapshot", () => {
  const source = functionSource("restoreProject");
  assert.match(source, /assertProjectRevision/);
  assert.match(source, /revision: actualRevision \+ 1/);
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

test("best-effort workspace cleanup saves do not create unhandled rejections", () => {
  assert.match(workspace, /void saveProject\(latest\)\.catch\(\(\) => undefined\)/);
  assert.match(studio, /void saveProject\(latest\)\.catch\(\(\) => undefined\)/);
});
