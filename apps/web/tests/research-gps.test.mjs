import test from "node:test";
import assert from "node:assert/strict";
import { getWorkspaceByPath, WORKSPACES } from "../src/domain/workspaces.mjs";

test("Research GPS is an active first-class workspace", () => {
  const gps = getWorkspaceByPath("/research-gps");
  assert.ok(gps);
  assert.equal(gps.id, "research-gps");
  assert.equal(gps.status, "active");
  assert.ok(WORKSPACES.some(workspace => workspace.id === "research-gps"));
});
