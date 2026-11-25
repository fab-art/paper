import test from "node:test";
import assert from "node:assert/strict";
import { recommendStatisticalOptions, createAnalysisRunManifest, getStudyComplianceChecklist } from "../frontend/src/lib/research-analysis.ts";

test("statistical recommendations consider study design and outcome type", () => {
  const result = recommendStatisticalOptions({ studyDesign: "randomized-trial", outcomeType: "continuous", groups: 2, paired: false, sampleSize: 120 });
  assert.ok(result.options.some(item => /t-test|linear/i.test(item.method)));
  assert.ok(result.assumptions.length > 0);
  assert.equal(result.requiresOwnerApproval, true);
});

test("cross-sectional binary outcome is not recommended a paired t-test", () => {
  const result = recommendStatisticalOptions({ studyDesign: "cross-sectional", outcomeType: "binary", groups: 2, paired: false, sampleSize: 250 });
  assert.ok(result.options.some(item => /logistic/i.test(item.method)));
  assert.ok(result.options.every(item => !/paired t-test/i.test(item.method)));
});

test("analysis run manifest preserves dataset fingerprint and reproducibility inputs", () => {
  const manifest = createAnalysisRunManifest({ datasetId: "d1", datasetFingerprint: "sha256:abc", transformations: ["drop duplicate IDs"], script: "analysis.py", software: { python: "3.12", pandas: "2.2" }, parameters: { alpha: 0.05 }, outputIds: ["table-1"] });
  assert.equal(manifest.datasetFingerprint, "sha256:abc");
  assert.equal(manifest.transformations[0], "drop duplicate IDs");
  assert.equal(manifest.ownerApproved, false);
});

test("compliance checklist changes with study design and does not assert approval", () => {
  const checklist = getStudyComplianceChecklist("empirical-study", "randomized-trial");
  assert.ok(checklist.some(item => item.guideline === "CONSORT"));
  assert.ok(checklist.some(item => /ethics/i.test(item.label)));
  assert.equal(checklist.every(item => item.confirmed === false), true);
});
