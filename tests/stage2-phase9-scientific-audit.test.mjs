import test from "node:test";
import assert from "node:assert/strict";
import { runScientificAudit, assessJournalFit, simulateReviewerPerspectives } from "../frontend/src/lib/scientific-audit.mjs";

const project = {
  id: "project-1",
  name: "Diabetes outcomes",
  researchQuestion: "What is the effect of intervention X?",
  objectives: ["Estimate change in HbA1c"],
  methodology: "A prospective cohort study",
  latex: String.raw`\documentclass{article}
\begin{document}
\cite{known2024,missing2025}
\end{document}`,
  bibtex: "@article{known2024, title={Known study}}",
  papers: [{ title: "Known study", doi: "10.1000/known" }]
};

const source = {
  id: "source-1", projectId: "project-1", entityType: "source", version: 1,
  status: "draft", title: "Known study", payload: { doi: "10.1000/known" },
  provenance: { kind: "owner", recordedAt: 1 }, createdAt: 1, updatedAt: 1
};

const claim = {
  id: "claim-1", projectId: "project-1", entityType: "claim", version: 1,
  status: "draft", title: "Intervention reduces HbA1c", payload: { text: "Intervention reduces HbA1c" },
  provenance: { kind: "owner", recordedAt: 1 }, createdAt: 1, updatedAt: 1
};

const passage = {
  id: "passage-1", projectId: "project-1", entityType: "research-note", version: 1,
  status: "draft", title: "Evidence passage",
  payload: { recordType: "evidence-passage", quote: "The intervention group improved.", sourceEntityId: "source-1", locator: "p. 4", judgement: "supports" },
  provenance: { kind: "owner", recordedAt: 1 }, createdAt: 1, updatedAt: 1
};

test("scientific audit flags claims without traceable evidence and creates actionable fix cards", () => {
  const report = runScientificAudit({ project, entities: [source, claim], relations: [], now: 100 });
  const finding = report.findings.find(item => item.category === "claim-evidence" && item.targetId === "claim-1");
  assert.ok(finding);
  assert.equal(finding.severity, "high");
  assert.ok(report.fixCards.some(card => card.findingId === finding.id));
});

test("scientific audit recognizes linked passages but never calls them independently verified", () => {
  const report = runScientificAudit({
    project, entities: [source, claim, passage],
    relations: [{ id: "r1", projectId: "project-1", fromEntityId: "passage-1", toEntityId: "claim-1", relationType: "supports" }],
    now: 100
  });
  const finding = report.findings.find(item => item.category === "claim-evidence" && item.targetId === "claim-1");
  assert.equal(finding, undefined);
  assert.equal(report.scope.claimEvidence, "researcher-assessed links; not independent scientific verification");
});

test("contradictory linked evidence is escalated as critical", () => {
  const contradictory = { ...passage, payload: { ...passage.payload, judgement: "contradicts" } };
  const report = runScientificAudit({
    project, entities: [source, claim, contradictory],
    relations: [{ id: "r1", projectId: "project-1", fromEntityId: "passage-1", toEntityId: "claim-1", relationType: "supports" }],
    now: 100
  });
  assert.equal(report.findings.find(item => item.category === "claim-evidence").severity, "critical");
});

test("citation audit identifies manuscript citation keys missing from the bibliography", () => {
  const report = runScientificAudit({ project, entities: [source], relations: [], now: 100 });
  const finding = report.findings.find(item => item.category === "citation-integrity");
  assert.ok(finding);
  assert.match(finding.evidence, /missing2025/);
});

test("unapproved analysis outputs are not treated as verified results", () => {
  const analysis = {
    id: "analysis-1", projectId: "project-1", entityType: "analysis", version: 1,
    status: "draft", title: "Preliminary result", payload: { summary: "Mean difference 2.1" },
    provenance: { kind: "owner", recordedAt: 1 }, createdAt: 1, updatedAt: 1
  };
  const report = runScientificAudit({ project, entities: [analysis], relations: [], now: 100 });
  assert.ok(report.findings.some(item => item.category === "analysis-approval" && item.targetId === "analysis-1"));
});

test("journal fit reports insufficient evidence without inventing metrics", () => {
  const result = assessJournalFit({
    manuscript: { title: "Diabetes outcomes", paperType: "empirical-study", keywords: ["diabetes"] },
    journal: { title: "Journal of Clinical Studies" }
  });
  assert.equal(result.status, "insufficient-data");
  assert.equal(result.acceptanceProbability, null);
  assert.equal(result.apc, null);
  assert.equal(result.reviewTimeline, null);
});

test("reviewer simulation is explicitly labeled as a simulation and yields traceable checklist prompts", () => {
  const result = simulateReviewerPerspectives({ project, auditReport: { findings: [] } });
  assert.equal(result.kind, "simulation");
  assert.equal(result.isPeerReview, false);
  assert.ok(result.perspectives.some(item => item.id === "methods"));
  assert.ok(result.perspectives.every(item => item.status === "prompt-only"));
});
