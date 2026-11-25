import test from "node:test";
import assert from "node:assert/strict";
import { assessClaimEvidence, createClaimRecord, createEvidencePassage, normalizeEvidenceText } from "../frontend/src/lib/evidence-intelligence.ts";
import { assessProtocolReadiness, createProtocolDraft } from "../frontend/src/lib/research-protocol.ts";

const now = 1800000000000;

test("claim creation starts unverified and never infers support from relevance", () => {
  const claim = createClaimRecord({ id: "claim-1", projectId: "project-1", text: "Vaccination coverage is below target.", now });
  assert.equal(claim.status, "awaiting-verification");
  assert.equal(claim.evidenceCount, 0);
  assert.equal(assessClaimEvidence(claim, []).status, "awaiting-verification");
});

test("evidence passage preserves exact quotation, source identity and locator", () => {
  const passage = createEvidencePassage({ id: "evidence-1", projectId: "project-1", sourceEntityId: "source-1", quote: "Exact source passage.", locator: "p. 4", now });
  assert.equal(passage.payload.quote, "Exact source passage.");
  assert.equal(passage.payload.sourceEntityId, "source-1");
  assert.equal(passage.payload.locator, "p. 4");
  assert.equal(passage.provenance.kind, "owner");
});

test("claim assessment distinguishes support, partial support, conflict and unsupported evidence", () => {
  const claim = createClaimRecord({ id: "claim-1", projectId: "project-1", text: "Claim", now });
  const assessment = (judgements) => assessClaimEvidence(claim, judgements.map((judgement, i) => ({ id: String(i), judgement })));
  assert.equal(assessment(["supports"]).status, "supported");
  assert.equal(assessment(["partially-supports"]).status, "partially-supported");
  assert.equal(assessment(["contradicts"]).status, "conflicting-evidence");
  assert.equal(assessment(["irrelevant"]).status, "unsupported");
  assert.equal(assessment(["supports", "contradicts"]).status, "conflicting-evidence");
});

test("evidence text normalization is comparison-only and does not rewrite quotations", () => {
  assert.equal(normalizeEvidenceText("  A  quoted\n passage "), "a quoted passage");
});

test("protocol readiness reports missing decisions and does not approve the protocol", () => {
  const draft = createProtocolDraft({ projectId: "project-1", now });
  const readiness = assessProtocolReadiness(draft);
  assert.equal(readiness.ready, false);
  assert.ok(readiness.missing.includes("research question"));
  assert.equal(draft.status, "draft");
  const complete = { ...draft, researchQuestion: "What works?", studyDesign: "cohort", setting: "Rwanda", population: "Adults", sampleSize: "500", outcomes: ["control"] , analysisPlan: "Regression" };
  assert.equal(assessProtocolReadiness(complete).ready, true);
});

test("protocol rejects empty or duplicated outcomes and invalid sample size", () => {
  const draft = createProtocolDraft({ projectId: "project-1", now });
  assert.throws(() => createProtocolDraft({ projectId: "project-1", now, outcomes: ["", ""] }), /outcome/i);
  assert.equal(assessProtocolReadiness({ ...draft, researchQuestion: "Q", studyDesign: "cohort", setting: "R", population: "P", sampleSize: "-1", outcomes: ["O"], analysisPlan: "A" }).ready, false);
});
