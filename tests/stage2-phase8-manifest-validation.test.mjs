import test from "node:test";
import assert from "node:assert/strict";
import { createAnalysisRunManifest } from "../frontend/src/lib/research-analysis.ts";

test("analysis manifest requires immutable dataset identity and a documented procedure", () => {
  assert.throws(() => createAnalysisRunManifest({ datasetId: "", datasetFingerprint: "", transformations: [], script: "", software: {}, parameters: {}, outputIds: [] }), /dataset ID/i);
  assert.throws(() => createAnalysisRunManifest({ datasetId: "d1", datasetFingerprint: "sha256:abc", transformations: [], script: "", software: {}, parameters: {}, outputIds: [] }), /script/i);
});
