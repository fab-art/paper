import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCitationUsage,
  createUniqueFigureAssets,
  rewriteFigureReferences,
  assertDatasetColumnCount,
  MAX_DATASET_COLUMNS
} from "../frontend/src/lib/phase6-regressions.mjs";

test("recognizes citation commands with one or two optional arguments", () => {
  const result = parseCitationUsage(
    String.raw`Text \parencite[see][p. 4]{alpha} and \citep[compare]{beta}.`,
    "@article{alpha, title={A}}\n@article{beta, title={B}}"
  );
  assert.deepEqual(result.citedKeys, ["alpha", "beta"]);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.uncited, []);
});

test("treats nocite star as citing every bibliography entry", () => {
  const result = parseCitationUsage(
    String.raw`\nocite{*}`,
    "@article{alpha, title={A}}\n@article{beta, title={B}}"
  );
  assert.deepEqual(result.citedKeys, ["alpha", "beta"]);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.uncited, []);
});

test("reports genuinely missing citation keys", () => {
  const result = parseCitationUsage(String.raw`\citep[see]{missing}`, "@article{known, title={K}}");
  assert.deepEqual(result.missing, ["missing"]);
  assert.deepEqual(result.uncited, ["known"]);
});

test("assigns unique archive paths to duplicate generated figure names", () => {
  const assets = createUniqueFigureAssets([
    { name: "figure.png", png: "AAAA", mime: "image/png" },
    { name: "figure.png", png: "BBBB", mime: "image/png" },
    { name: "figure.png", png: "CCCC", mime: "image/png" }
  ]);
  assert.deepEqual(assets.map(item => item.exportName), ["figure.png", "figure-2.png", "figure-3.png"]);
});

test("rewrites LaTeX figure references to the matching exported asset path", () => {
  const assets = createUniqueFigureAssets([{ name: "plot.svg", png: "PHN2Zz4=", mime: "image/svg+xml" }]);
  const tex = String.raw`\includegraphics[width=\linewidth]{plot.svg}`;
  assert.equal(rewriteFigureReferences(tex, assets), String.raw`\includegraphics[width=\linewidth]{figures/plot.svg}`);
});

test("enforces a safe dataset column limit before allocating huge arrays", () => {
  assert.equal(MAX_DATASET_COLUMNS, 250);
  assert.doesNotThrow(() => assertDatasetColumnCount(250));
  assert.throws(() => assertDatasetColumnCount(251), /250 columns/);
});
