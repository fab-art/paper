import test from "node:test";
import assert from "node:assert/strict";
import {
  createScientificAudit, updateAuditFinding, summarizeScientificAudit, finalizeScientificAudit,
  createPublicationPlan, updatePublicationPlan, getPublicationReadiness, createCoverLetter, transitionPublicationStatus
} from "../src/domain/scientific-publication.mjs";

const project = {
  id: "project-1",
  name: "Digital interventions for diabetes care",
  researchQuestion: "What digital interventions improve diabetes outcomes?",
  objectives: ["Assess glycaemic outcomes"],
  methodology: "Systematic review",
  papers: [{ title: "Trial A", doi: "10.1000/a", abstract: "An abstract" }],
  latex: "\\section{Introduction} Draft manuscript",
  bibtex: "@article{trialA,title={Trial A}}",
  systematicReview: {
    protocol: { reviewType: "systematic", population: "Adults", searchDate: "2026-01-01", databases: ["PubMed"], inclusionCriteria: "Adults", exclusionCriteria: "Children" },
    screening: { a: { titleAbstractDecision: "include", fullTextDecision: "include" } },
    extraction: { a: { studyDesign: "RCT", sampleSize: "120" } },
    riskOfBias: { a: { tool: "RoB 2", domains: [{ judgement: "low", rationale: "Allocation concealed" }] } }
  }
};

test("creates a transparent scientific audit from project records without asserting scientific validity", () => {
  const audit = createScientificAudit(project, { attachments: [], now: 100 });
  assert.equal(audit.projectId, project.id);
  assert.ok(audit.findings.some(item => item.category === "protocol"));
  assert.ok(audit.findings.some(item => item.category === "evidence"));
  assert.ok(audit.findings.some(item => item.category === "methods"));
  assert.ok(audit.findings.some(item => item.category === "ethics"));
  assert.ok(audit.findings.every(item => item.status === "not-reviewed"));
  assert.equal(audit.signoff, null);
  assert.equal(summarizeScientificAudit(audit).scientificQualityScore, null);
});

test("records reviewer decisions and preserves an append-only audit history", () => {
  const audit = createScientificAudit(project, { now: 100 });
  const finding = audit.findings[0];
  const reviewed = updateAuditFinding(audit, finding.id, {
    status: "verified", reviewer: "Researcher A", note: "Checked against approved protocol"
  }, { now: 200 });
  assert.equal(reviewed.findings[0].status, "verified");
  assert.equal(reviewed.history.length, audit.history.length + 1);
  assert.equal(audit.findings[0].status, "not-reviewed");
  assert.throws(() => updateAuditFinding(reviewed, finding.id, { status: "verified", reviewer: "" }), /reviewer/i);
  assert.throws(() => updateAuditFinding(reviewed, "missing", { status: "verified", reviewer: "A" }), /finding/i);
});

test("blocks scientific audit sign-off until every applicable finding is reviewed", () => {
  const audit = createScientificAudit(project, { now: 100 });
  assert.throws(() => finalizeScientificAudit(audit, { reviewer: "Principal Investigator", now: 300 }), /unreviewed/i);
  const reviewed = audit.findings.reduce((current, finding) => updateAuditFinding(current, finding.id, {
    status: "not-applicable", reviewer: "Principal Investigator", note: "Not applicable to this design"
  }, { now: 200 }), audit);
  const signed = finalizeScientificAudit(reviewed, { reviewer: "Principal Investigator", now: 300 });
  assert.equal(signed.signoff.reviewer, "Principal Investigator");
  assert.equal(signed.signoff.findingsReviewed, signed.findings.length);
  assert.equal(summarizeScientificAudit(signed).scientificQualityScore, null);
});

test("creates a local publication plan with explicit declarations and no automatic submission", () => {
  const plan = createPublicationPlan(project, { now: 10 });
  assert.equal(plan.projectId, project.id);
  assert.equal(plan.status, "draft");
  assert.equal(plan.targetJournal, "");
  assert.deepEqual(plan.authors, []);
  assert.equal(plan.submittedAt, null);
});

test("publication readiness identifies missing journal, authors, declarations and manuscript metadata", () => {
  const plan = createPublicationPlan(project, { now: 10 });
  const readiness = getPublicationReadiness(project, plan);
  assert.equal(readiness.ready, false);
  assert.ok(readiness.missing.includes("target-journal"));
  assert.ok(readiness.missing.includes("authors"));
  assert.ok(readiness.missing.includes("ethics-declaration"));
  assert.ok(readiness.missing.includes("conflict-of-interest"));
});

test("valid publication plan can be marked ready but submission requires explicit researcher action", () => {
  const plan = {
    ...createPublicationPlan(project, { now: 10 }),
    targetJournal: "Journal of Digital Health",
    articleType: "systematic-review",
    title: project.name,
    abstract: "A structured abstract.",
    keywords: ["diabetes", "digital health"],
    authors: [{ name: "Researcher A", affiliation: "University", orcid: "", corresponding: true }],
    ethicsDeclaration: "Not applicable; review of published literature.",
    fundingDeclaration: "No external funding.",
    conflictOfInterest: "The authors declare no conflicts.",
    dataAvailability: "Extraction data available on request."
  };
  const ready = transitionPublicationStatus(project, plan, "ready", { actor: "Researcher A", now: 20 });
  assert.equal(ready.status, "ready");
  assert.throws(() => transitionPublicationStatus(project, ready, "submitted", { actor: "Researcher A", now: 30 }), /explicit submission confirmation/i);
  const submitted = transitionPublicationStatus(project, ready, "submitted", { actor: "Researcher A", now: 30, confirmExternalSubmission: true });
  assert.equal(submitted.status, "submitted");
  assert.equal(submitted.submittedAt, 30);
});

test("generates a cover letter only from researcher-provided publication metadata", () => {
  const plan = {
    ...createPublicationPlan(project),
    targetJournal: "Journal of Digital Health",
    title: "A digital health review",
    authors: [{ name: "Researcher A", affiliation: "University", corresponding: true }],
    articleType: "systematic-review"
  };
  const letter = createCoverLetter(plan);
  assert.match(letter, /Journal of Digital Health/);
  assert.match(letter, /A digital health review/);
  assert.doesNotMatch(letter, /novel|first study|proves/i);
});
