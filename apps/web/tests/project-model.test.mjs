import test from "node:test";
import assert from "node:assert/strict";
import {
  createProjectRecord,
  isArchivedProject,
  isDuplicatePaper,
  normalizeDoi,
  normalizePaperTitle
} from "../src/features/projects/projectModel.mjs";

test("creates a complete local project record from a validated intake", () => {
  const project = createProjectRecord({
    name: "  Diabetes precision research  ",
    description: "A study of treatment response",
    researchQuestion: "Which factors predict response?",
    paperType: "empirical",
    intendedAudience: "Clinical researchers",
    availableMaterials: [" EHR data ", "", "Patient surveys"],
    researchMode: "guided"
  }, { id: "project-001", now: 1_800_000_000_000 });

  assert.equal(project.id, "project-001");
  assert.equal(project.name, "Diabetes precision research");
  assert.equal(project.notes, "Research context: A study of treatment response");
  assert.equal(project.researchQuestion, "Which factors predict response?");
  assert.equal(project.paperType, "empirical");
  assert.equal(project.intendedAudience, "Clinical researchers");
  assert.deepEqual(project.availableMaterials, ["EHR data", "Patient surveys"]);
  assert.equal(project.researchMode, "guided");
  assert.equal(project.status, "planning");
  assert.equal(project.updatedAt, 1_800_000_000_000);
  assert.equal(project.revision, undefined);
  assert.equal(project.agentRecords.length, 5);
  assert.ok(project.latex.includes("\\documentclass"));
  assert.deepEqual(project.papers, []);
  assert.deepEqual(project.milestones, []);
});

test("rejects empty, whitespace-only and overlong project names", () => {
  assert.throws(() => createProjectRecord({ name: "" }, { id: "p1", now: 1 }), /Project name is required/);
  assert.throws(() => createProjectRecord({ name: "   " }, { id: "p1", now: 1 }), /Project name is required/);
  assert.throws(() => createProjectRecord({ name: "x".repeat(181) }, { id: "p1", now: 1 }), /180 characters/);
});

test("normalizes DOI URLs and DOI prefixes consistently", () => {
  assert.equal(normalizeDoi("https://doi.org/10.1000/ABC.123"), "10.1000/abc.123");
  assert.equal(normalizeDoi("doi: 10.1000/ABC.123"), "10.1000/abc.123");
  assert.equal(normalizeDoi(" 10.1000/ABC.123 "), "10.1000/abc.123");
});

test("normalizes paper titles across punctuation, case and Unicode composition", () => {
  assert.equal(normalizePaperTitle("  Diabetes—Care: A REVIEW! "), "diabetescareareview");
  assert.equal(normalizePaperTitle("café"), normalizePaperTitle("cafe\u0301"));
});

test("detects duplicate papers by DOI or normalized title", () => {
  const existing = [
    { title: "Precision Medicine in Diabetes", doi: "10.1000/abc.1" },
    { title: "A Second Study", doi: "10.1000/abc.2" }
  ];
  assert.equal(isDuplicatePaper(existing, { title: "Different title", doi: "https://doi.org/10.1000/ABC.1" }), true);
  assert.equal(isDuplicatePaper(existing, { title: "precision medicine in diabetes", doi: "" }), true);
  assert.equal(isDuplicatePaper(existing, { title: "A New Study", doi: "10.1000/abc.3" }), false);
});

test("identifies archived projects without changing the project record", () => {
  const archived = { id: "p1", archivedAt: 1234 };
  const active = { id: "p2" };
  assert.equal(isArchivedProject(archived), true);
  assert.equal(isArchivedProject(active), false);
  assert.deepEqual(archived, { id: "p1", archivedAt: 1234 });
});
