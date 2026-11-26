import test from "node:test";
import assert from "node:assert/strict";
import { profileDataset, summarizeDataset } from "../src/domain/dataset-analysis.mjs";

test("profiles numeric, date and text variables with missingness and unique counts", () => {
  const result = profileDataset(
    ["age", "visit_date", "arm"],
    [["20", "2026-01-01", "A"], ["", "2026-01-02", "B"], ["40", "", "A"]],
    3
  );
  assert.deepEqual(result.map(({ name, type, missing, unique, min, max, mean, median }) =>
    ({ name, type, missing, unique, min, max, mean, median })), [
    { name: "age", type: "Numeric", missing: 1, unique: 2, min: "20", max: "40", mean: "30.00", median: "30.00" },
    { name: "visit_date", type: "Date", missing: 1, unique: 2, min: undefined, max: undefined, mean: undefined, median: undefined },
    { name: "arm", type: "Text", missing: 0, unique: 2, min: undefined, max: undefined, mean: undefined, median: undefined }
  ]);
});

test("does not classify an all-missing column as numeric or date", () => {
  const [column] = profileDataset(["empty"], [[""], ["  "]], 2);
  assert.equal(column.type, "Text");
  assert.equal(column.missing, 2);
  assert.equal(column.unique, 0);
});

test("summarizes dataset dimensions, missing cells and duplicate rows", () => {
  const summary = summarizeDataset(
    ["id", "value"],
    [["1", "10"], ["2", ""], ["1", "10"]],
    3
  );
  assert.deepEqual(summary, {
    rows: 3, columns: 2, missingCells: 1, duplicateRows: 1, completeRows: 2
  });
});

test("handles empty and truncated previews without inventing rows", () => {
  assert.deepEqual(summarizeDataset(["a"], [], 0), {
    rows: 0, columns: 1, missingCells: 0, duplicateRows: 0, completeRows: 0
  });
});
