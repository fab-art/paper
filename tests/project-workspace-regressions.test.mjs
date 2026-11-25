import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workspace = readFileSync(new URL("../frontend/src/components/ProjectWorkspace.tsx", import.meta.url), "utf8");

test("attachment downloads keep the object URL alive until the browser starts the download", () => {
  const start = workspace.indexOf("const downloadAttachment");
  const end = workspace.indexOf("\n  const ", start + 1);
  const source = workspace.slice(start, end === -1 ? workspace.length : end);
  assert.match(source, /window\.setTimeout\(\(\)\s*=>\s*URL\.revokeObjectURL\(url\),\s*1000\)/);
});

test("project workspace distinguishes save errors from successful status notices", () => {
  assert.match(workspace, /noticeIsError/);
  assert.match(workspace, /role=\{noticeIsError \? "alert" : "status"\}/);
  assert.match(workspace, /<AlertCircle/);
});
