import test from "node:test";
import assert from "node:assert/strict";
import {
  createProjectDraft, filterProjects, getProjectCollection, validateProjectDraft,
  toggleMilestone, projectRoute
} from "../src/domain/project-management.mjs";

test("new project draft starts with safe, complete defaults", () => {
  const draft = createProjectDraft({ id: "p-1", name: "  Diabetes study  ", now: 100 });
  assert.equal(draft.id, "p-1");
  assert.equal(draft.name, "Diabetes study");
  assert.equal(draft.status, "planning");
  assert.deepEqual(draft.papers, []);
  assert.deepEqual(draft.outline, []);
  assert.deepEqual(draft.milestones, []);
  assert.equal(draft.updatedAt, 100);
});

test("project draft validation requires a non-empty name and caps its length", () => {
  assert.match(validateProjectDraft({ name: "   " }), /name/i);
  assert.match(validateProjectDraft({ name: "x".repeat(201) }), /200/);
  assert.equal(validateProjectDraft({ name: "A valid project" }), "");
});

test("project search matches names, questions, and objectives without changing source records", () => {
  const projects = [
    { id: "1", name: "Diabetes", researchQuestion: "Medication adherence", objectives: ["Rwanda"] },
    { id: "2", name: "Vaccination", researchQuestion: "Timeliness", objectives: [] }
  ];
  assert.deepEqual(filterProjects(projects, "adherence").map(p => p.id), ["1"]);
  assert.deepEqual(filterProjects(projects, "rwanda").map(p => p.id), ["1"]);
  assert.equal(projects[0].name, "Diabetes");
});

test("active and archived collections remain separate and stable", () => {
  const projects = [
    { id: "1", name: "A", updatedAt: 10 },
    { id: "2", name: "B", updatedAt: 30, archivedAt: 20 },
    { id: "3", name: "C", updatedAt: 20 }
  ];
  const result = getProjectCollection(projects);
  assert.deepEqual(result.active.map(p => p.id), ["3", "1"]);
  assert.deepEqual(result.archived.map(p => p.id), ["2"]);
});

test("milestones are completed by stable id without mutating input", () => {
  const project = { milestones: [{ id: "m1", title: "Protocol", completed: false }] };
  const updated = toggleMilestone(project, "m1", true);
  assert.equal(updated.milestones[0].completed, true);
  assert.equal(project.milestones[0].completed, false);
  assert.equal(toggleMilestone(project, "missing", true), project);
});

test("project routes encode identifiers and preserve direct navigation", () => {
  assert.equal(projectRoute("p 1"), "/projects/p%201");
});
