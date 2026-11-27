import test from "node:test";
import assert from "node:assert/strict";
import { refreshSelectedSharedProject } from "../src/domain/collaboration.mjs";
import { loadAccountProfile } from "../src/domain/manage-account.mjs";

test("refresh reloads details when the selected shared project is still selected", async () => {
  const refreshed = [];
  const selected = [];
  const cleared = [];
  await refreshSelectedSharedProject(
    [{ id: "cloud-1" }, { id: "cloud-2" }],
    "cloud-1",
    {
      refreshDetails: async id => refreshed.push(id),
      setSelectedId: id => selected.push(id),
      clearDetails: () => cleared.push(true)
    }
  );
  assert.deepEqual(refreshed, ["cloud-1"]);
  assert.deepEqual(selected, []);
  assert.deepEqual(cleared, []);
});

test("refresh changes to the first available shared project when the selection disappeared", async () => {
  const refreshed = [];
  const selected = [];
  const cleared = [];
  await refreshSelectedSharedProject(
    [{ id: "cloud-2" }],
    "cloud-1",
    {
      refreshDetails: async id => refreshed.push(id),
      setSelectedId: id => selected.push(id),
      clearDetails: () => cleared.push(true)
    }
  );
  assert.deepEqual(refreshed, []);
  assert.deepEqual(selected, ["cloud-2"]);
  assert.deepEqual(cleared, [true]);
});

test("refresh clears stale detail records when no shared projects remain", async () => {
  const refreshed = [];
  const selected = [];
  const cleared = [];
  await refreshSelectedSharedProject(
    [],
    "cloud-1",
    {
      refreshDetails: async id => refreshed.push(id),
      setSelectedId: id => selected.push(id),
      clearDetails: () => cleared.push(true)
    }
  );
  assert.deepEqual(refreshed, []);
  assert.deepEqual(selected, [""]);
  assert.deepEqual(cleared, [true]);
});

test("account profile loading returns a blank account for signed-out sessions", async () => {
  const account = await loadAccountProfile(null, null);
  assert.deepEqual(account, { user: null, email: "", displayName: "" });
});

test("account profile loading retrieves the display name for the authenticated user", async () => {
  const calls = [];
  const client = {
    from(table) {
      calls.push(["from", table]);
      return {
        select(columns) {
          calls.push(["select", columns]);
          return {
            eq(column, value) {
              calls.push(["eq", column, value]);
              return {
                async maybeSingle() {
                  calls.push(["maybeSingle"]);
                  return { data: { display_name: "Researcher One" }, error: null };
                }
              };
            }
          };
        }
      };
    }
  };
  const user = { id: "user-1", email: "researcher@example.org" };
  const account = await loadAccountProfile(client, user);
  assert.deepEqual(account, { user, email: "researcher@example.org", displayName: "Researcher One" });
  assert.deepEqual(calls, [
    ["from", "profiles"], ["select", "display_name"], ["eq", "id", "user-1"], ["maybeSingle"]
  ]);
});

test("account profile loading surfaces profile query errors", async () => {
  const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: new Error("profile unavailable") }) }) }) }) };
  await assert.rejects(() => loadAccountProfile(client, { id: "user-1" }), /profile unavailable/);
});
