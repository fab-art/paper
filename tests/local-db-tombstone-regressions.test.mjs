import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertProjectWritable } from "../frontend/src/lib/project-write-guard.mjs";

const dbSource = readFileSync(new URL("../frontend/src/lib/db.ts", import.meta.url), "utf8");

function functionSource(name) {
  const start = dbSource.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `Missing database function: ${name}`);
  const end = dbSource.indexOf("\nexport async function", start + 1);
  return dbSource.slice(start, end === -1 ? dbSource.length : end);
}

for (const [name, store] of [
  ["saveProjectNote", "notes"],
  ["saveProjectAttachment", "attachments"],
  ["recordProjectSearch", "searches"]
]) {
  test(`${name} checks project deletion state in the same IndexedDB transaction`, () => {
    const source = functionSource(name);
    assert.match(source, new RegExp(
      `db\\.transaction\\("rw",\\s*db\\.projects,\\s*db\\.deletedProjects,\\s*db\\.${store}`
    ));
    assert.match(source, /assertProjectWritable\(/);
  });
}

test("search history pruning stays inside the guarded write transaction", () => {
  const source = functionSource("recordProjectSearch");
  assert.match(source, /db\.searches\.bulkDelete/);
  assert.match(source, /db\.searches\.where\("projectId"\)/);
});

test("write guard rejects a project tombstoned by another tab", async () => {
  await assert.rejects(
    assertProjectWritable("deleted-project", {
      getDeletedProject: async () => ({ id: "deleted-project", deletedAt: 123 }),
      getProject: async () => ({ id: "deleted-project" })
    }),
    /permanently deleted in another tab/
  );
});

test("write guard rejects orphan writes when the project record is missing", async () => {
  await assert.rejects(
    assertProjectWritable("missing-project", {
      getDeletedProject: async () => undefined,
      getProject: async () => undefined
    }),
    /project no longer exists/
  );
});

test("write guard permits writes to an existing project without a tombstone", async () => {
  await assert.doesNotReject(
    assertProjectWritable("active-project", {
      getDeletedProject: async () => undefined,
      getProject: async () => ({ id: "active-project" })
    })
  );
});
