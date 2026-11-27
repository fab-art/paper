import test from "node:test";
import assert from "node:assert/strict";
import { WORKSPACES, getWorkspaceByPath, getWorkspaceGroups } from "../src/domain/workspaces.mjs";

test("workspace registry exposes unique ids and paths", () => {
  assert.equal(new Set(WORKSPACES.map((item) => item.id)).size, WORKSPACES.length);
  assert.equal(new Set(WORKSPACES.map((item) => item.path)).size, WORKSPACES.length);
});

test("all planned Research Factory stations are represented", () => {
  for (const id of ["station", "projects", "blueprint", "production", "literature", "evidence", "writing", "data", "systematic-review", "quality", "publication", "collaboration", "settings"]) {
    assert.ok(WORKSPACES.some((workspace) => workspace.id === id), `missing workspace: ${id}`);
  }
});

test("route lookup resolves only registered paths", () => {
  assert.equal(getWorkspaceByPath("/").id, "station");
  assert.equal(getWorkspaceByPath("/literature").id, "literature");
  assert.equal(getWorkspaceByPath("/not-a-route"), undefined);
});

test("workspace groups preserve every workspace exactly once", () => {
  const grouped = Object.values(getWorkspaceGroups()).flat();
  assert.equal(grouped.length, WORKSPACES.length);
  assert.deepEqual(new Set(grouped.map((item) => item.id)), new Set(WORKSPACES.map((item) => item.id)));
});


test("systematic reviews is enabled as the next migrated research workspace", () => {
  const workspace = getWorkspaceByPath("/systematic-reviews");
  assert.equal(workspace.id, "systematic-review");
  assert.equal(workspace.status, "active");
});


test("scientific audit and publication workspaces are enabled under Publish", () => {
  assert.equal(getWorkspaceByPath("/quality").status, "active");
  assert.equal(getWorkspaceByPath("/publication").status, "active");
  assert.equal(getWorkspaceByPath("/quality").group, "Publish");
  assert.equal(getWorkspaceByPath("/publication").group, "Publish");
});


test("collaboration and settings are enabled under Manage", () => {
  assert.equal(getWorkspaceByPath("/collaboration").status, "active");
  assert.equal(getWorkspaceByPath("/settings").status, "active");
  assert.equal(getWorkspaceByPath("/collaboration").group, "Manage");
  assert.equal(getWorkspaceByPath("/settings").group, "Manage");
});
