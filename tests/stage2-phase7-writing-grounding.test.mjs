import test from "node:test";
import assert from "node:assert/strict";
import { buildGroundedWritingContext, assessDraftClaimSupport } from "../frontend/src/lib/writing-grounding.ts";

test("writing context includes only exact, source-linked passages and verified results", () => {
  const context = buildGroundedWritingContext([
    { id: "p1", entityType: "research-note", status: "draft", title: "Passage", payload: { recordType: "evidence-passage", quote: "Exact quotation", sourceEntityId: "s1", locator: "p. 4", judgement: "supports" } },
    { id: "p2", entityType: "research-note", status: "draft", title: "Unlinked", payload: { recordType: "evidence-passage", quote: "No source link", sourceEntityId: "" } },
    { id: "a1", entityType: "analysis", status: "approved", title: "Verified result", payload: { summary: "Mean difference 2.1" } },
    { id: "a2", entityType: "analysis", status: "draft", title: "Unapproved result", payload: { summary: "Speculative result" } }
  ]);
  assert.equal(context.passages.length, 1);
  assert.equal(context.passages[0].sourceEntityId, "s1");
  assert.equal(context.verifiedResults.length, 1);
  assert.match(context.promptContext, /Exact quotation/);
  assert.doesNotMatch(context.promptContext, /Speculative result/);
});

test("unsupported generated factual claims remain visibly awaiting verification", () => {
  const result = assessDraftClaimSupport([{ text: "Claim A", evidenceEntityIds: ["p1"] }, { text: "Claim B", evidenceEntityIds: [] }], ["p1"]);
  assert.equal(result[0].status, "evidence-linked");
  assert.equal(result[1].status, "awaiting-verification");
});

test("claim support rejects unknown evidence IDs rather than treating them as support", () => {
  const result = assessDraftClaimSupport([{ text: "Claim", evidenceEntityIds: ["missing"] }], ["p1"]);
  assert.equal(result[0].status, "awaiting-verification");
});
