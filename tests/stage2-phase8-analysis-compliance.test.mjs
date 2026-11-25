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

test("descriptive analysis executes deterministic grouped summaries from actual dataset rows", async () => {
  const { executeDescriptiveAnalysis } = await import("../frontend/src/lib/research-analysis.ts");
  const result = executeDescriptiveAnalysis({
    datasetName: "trial.csv",
    headers: ["arm", "change"],
    rows: [["A", "2"], ["A", "4"], ["B", "6"], ["B", "8"], ["B", ""]],
    outcomeColumn: "change",
    groupColumn: "arm",
    outcomeType: "continuous"
  });
  assert.equal(result.rowCountAnalyzed, 5);
  assert.deepEqual(result.table.rows.map(row => row.group), ["A", "B"]);
  assert.equal(result.table.rows[0].mean, 3);
  assert.equal(result.table.rows[1].mean, 7);
  assert.equal(result.table.rows[1].missing, 1);
  assert.equal(result.figure.values[0], 3);
  assert.match(result.caption, /trial.csv/);
});

test("categorical analysis returns group denominators and percentages", async () => {
  const { executeDescriptiveAnalysis } = await import("../frontend/src/lib/research-analysis.ts");
  const result = executeDescriptiveAnalysis({
    datasetName: "survey.csv",
    headers: ["site", "response"],
    rows: [["North", "Yes"], ["North", "No"], ["North", "Yes"], ["South", "No"]],
    outcomeColumn: "response",
    groupColumn: "site",
    outcomeType: "binary"
  });
  const northYes = result.table.rows.find(row => row.group === "North" && row.category === "Yes");
  assert.equal(northYes.count, 2);
  assert.equal(northYes.percent, 66.67);
  assert.equal(result.figure.values.reduce((sum, value) => sum + value, 0), 4);
});

test("descriptive analysis refuses truncated inputs and unsupported time-to-event execution", async () => {
  const { executeDescriptiveAnalysis } = await import("../frontend/src/lib/research-analysis.ts");
  const input = { datasetName: "data.csv", headers: ["x"], rows: [["1"]], outcomeColumn: "x", outcomeType: "continuous" };
  assert.throws(() => executeDescriptiveAnalysis({ ...input, truncated: true }), /truncated/i);
  assert.throws(() => executeDescriptiveAnalysis({ ...input, outcomeType: "time-to-event" }), /time-to-event/i);
});

test("figure export produces a self-contained SVG with title, axes and values", async () => {
  const { executeDescriptiveAnalysis, renderAnalysisFigureSvg } = await import("../frontend/src/lib/research-analysis.ts");
  const result = executeDescriptiveAnalysis({ datasetName: "data.csv", headers: ["group", "score"], rows: [["A", "3"], ["B", "5"]], outcomeColumn: "score", groupColumn: "group", outcomeType: "continuous" });
  const svg = renderAnalysisFigureSvg(result.figure);
  assert.match(svg, /<svg/);
  assert.match(svg, /Mean score/);
  assert.match(svg, />A</);
  assert.match(svg, />5\.00</);
});

test("analysis manifest records execution environment, timestamps, logs and outputs", () => {
  const manifest = createAnalysisRunManifest({
    datasetId: "d1", datasetFingerprint: "sha256:abc", transformations: [], script: "descriptive-analysis@1",
    software: { engine: "PaperOrchestra JS v1" }, parameters: { outcome: "score" }, outputIds: ["out-1"],
    execution: { status: "completed", startedAt: 10, completedAt: 20, durationMs: 10, runtime: "browser", analyzedRows: 42, logs: ["parsed", "summarized"] }
  });
  assert.equal(manifest.execution?.status, "completed");
  assert.equal(manifest.execution?.analyzedRows, 42);
  assert.equal(manifest.outputIds[0], "out-1");
  assert.equal(manifest.ownerApproved, false);
});
