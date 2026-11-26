import test from "node:test";
import assert from "node:assert/strict";
import { MAX_DATASET_CELLS, MAX_DATASET_COLUMNS, assertDatasetColumnCount, canRetainDatasetRow } from "../src/features/data/dataMethodsModel.mjs";

test("enforces the supported dataset column limit", () => {
  assert.equal(MAX_DATASET_COLUMNS, 250);
  assert.doesNotThrow(() => assertDatasetColumnCount(250));
  assert.throws(() => assertDatasetColumnCount(251), /250 columns/);
  assert.throws(() => assertDatasetColumnCount(0), /250 columns/);
});

test("retains rows only while the strict cell budget is respected", () => {
  assert.equal(MAX_DATASET_CELLS, 500000);
  assert.equal(canRetainDatasetRow(499990, 10), true);
  assert.equal(canRetainDatasetRow(499991, 10), false);
  assert.equal(canRetainDatasetRow(-1, 1), false);
  assert.equal(canRetainDatasetRow(0, 0), false);
  assert.equal(canRetainDatasetRow(0.5, 1), false);
});
