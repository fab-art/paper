import test from "node:test";
import assert from "node:assert/strict";
import { createSharedProjectPayload, mergeSharedProjectPayload, canEditSharedProject, canManageProjectMembers, validateMemberAssignment, normalizeProjectComment } from "../src/domain/collaboration.mjs";

const project = {
  id: "local-1", name: "Research project", notes: "Notes", latex: "\\section{Intro}",
  bibtex: "@article{a}", papers: [{ title: "Paper A" }], figures: [{ name: "figure.png", png: "large-base64" }],
  logs: "private execution logs", agentRecords: [{ summary: "private" }], templateFiles: { "secret.tex": "template" },
  revision: 12, archivedAt: 100, cloudProjectId: "cloud-1", cloudRevision: 4,
  systematicReview: { protocol: { reviewType: "systematic" } }
};

test("cloud sharing serializes research records but excludes local-only runtime and large binary assets", () => {
  const payload = createSharedProjectPayload(project);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.project.id, "local-1");
  assert.equal(payload.project.latex, project.latex);
  assert.deepEqual(payload.project.papers, project.papers);
  assert.deepEqual(payload.project.systematicReview, project.systematicReview);
  for (const key of ["logs", "agentRecords", "templateFiles", "figures", "revision", "archivedAt", "cloudProjectId", "cloudRevision"]) {
    assert.equal(Object.hasOwn(payload.project, key), false, `unexpected shared field: ${key}`);
  }
});

test("cloud roles follow least-privilege collaboration permissions", () => {
  assert.equal(canEditSharedProject("owner"), true);
  assert.equal(canEditSharedProject("editor"), true);
  assert.equal(canEditSharedProject("viewer"), false);
  assert.equal(canManageProjectMembers("owner"), true);
  assert.equal(canManageProjectMembers("editor"), false);
  assert.equal(canManageProjectMembers("viewer"), false);
});

test("member assignments accept only existing account UUIDs and non-owner roles", () => {
  assert.deepEqual(validateMemberAssignment("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "editor"), {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", role: "editor"
  });
  assert.throws(() => validateMemberAssignment("not-an-id", "viewer"), /valid account id/i);
  assert.throws(() => validateMemberAssignment("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "owner"), /owner role/i);
});

test("remote pulls preserve local identity and cloud revision metadata", () => {
  const merged = mergeSharedProjectPayload(project, {
    schemaVersion: 1,
    project: { id: "local-1", name: "Remote name", latex: "Remote manuscript", papers: [] }
  }, { cloudProjectId: "cloud-1", cloudRevision: 5 });
  assert.equal(merged.id, "local-1");
  assert.equal(merged.name, "Remote name");
  assert.equal(merged.revision, 12);
  assert.equal(merged.cloudProjectId, "cloud-1");
  assert.equal(merged.cloudRevision, 5);
  assert.throws(() => mergeSharedProjectPayload(project, { schemaVersion: 1, project: { id: "other" } }), /different local project/i);
});

test("project comments are trimmed and bounded before persistence", () => {
  assert.deepEqual(normalizeProjectComment({ projectId: "cloud-1", authorId: "user-1", body: "  Please clarify this method.  " }), {
    project_id: "cloud-1", author_id: "user-1", body: "Please clarify this method.", resource_type: "project"
  });
  assert.throws(() => normalizeProjectComment({ projectId: "cloud-1", authorId: "user-1", body: "  " }), /cannot be empty/i);
  assert.throws(() => normalizeProjectComment({ projectId: "cloud-1", authorId: "user-1", body: "x".repeat(10001) }), /10000/i);
});
