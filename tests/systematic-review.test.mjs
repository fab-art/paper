import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDoi,
  deduplicatePapers,
  syncReviewRecords,
  calculatePrismaFlow,
  toEvidenceMatrixCsv
} from "../frontend/src/lib/systematic-review.mjs";

test("normalizes DOI URLs and prefixes consistently", () => {
  assert.equal(normalizeDoi("https://doi.org/10.1000/ABC "), "10.1000/abc");
  assert.equal(normalizeDoi("doi:10.1000/ABC."), "10.1000/abc");
});

test("deduplicates papers by DOI and normalized title", () => {
  const result = deduplicatePapers([
    { title: "A Clinical Trial", doi: "https://doi.org/10.1000/ABC", authors: ["A"] },
    { title: "Different title, same DOI", doi: "10.1000/abc", authors: ["B"] },
    { title: "Population health cohort", authors: ["C"] },
    { title: "Population-health cohort!", authors: ["D"] },
    { title: "Another title", doi: "10.1000/b", authors: ["E"] },
    { title: "Different title, same DOI", doi: "10.1000/c", authors: ["F"] }
  ]);
  assert.equal(result.uniquePapers.length, 2);
  assert.equal(result.duplicatesRemoved, 4);
});

test("synchronizes new library papers without erasing existing screening decisions", () => {
  const papers = [
    { title: "Study A", doi: "10.1000/a" },
    { title: "Study B", doi: "10.1000/b" }
  ];
  const key = "doi:10.1000/a";
  const result = syncReviewRecords(papers, {
    [key]: { titleAbstractDecision: "include", titleAbstractReason: "Relevant", fullTextRetrieved: false, fullTextDecision: "pending" }
  });
  assert.equal(result.screening[key].titleAbstractDecision, "include");
  assert.equal(result.screening[key].titleAbstractReason, "Relevant");
  assert.equal(Object.values(result.screening).filter(x => x.titleAbstractDecision === "pending").length, 1);
});

test("computes transparent PRISMA-style screening flow counts", () => {
  const papers = [
    { title: "Excluded at abstract", doi: "10.1000/a" },
    { title: "Included study", doi: "10.1000/b" },
    { title: "Awaiting full text", doi: "10.1000/c" }
  ];
  const screening = {
    "doi:10.1000/a": { titleAbstractDecision: "exclude", fullTextRetrieved: false, fullTextDecision: "pending" },
    "doi:10.1000/b": { titleAbstractDecision: "include", fullTextRetrieved: true, fullTextDecision: "include" },
    "doi:10.1000/c": { titleAbstractDecision: "maybe", fullTextRetrieved: false, fullTextDecision: "pending" }
  };
  const flow = calculatePrismaFlow(papers, screening);
  assert.deepEqual(flow, {
    identified: 3,
    duplicatesRemoved: 0,
    recordsAfterDuplicates: 3,
    recordsScreened: 3,
    recordsNotScreened: 0,
    recordsExcluded: 1,
    reportsSought: 2,
    reportsNotRetrieved: 1,
    reportsAssessed: 1,
    fullTextExcluded: 0,
    studiesIncluded: 1,
    awaitingFullTextDecision: 0
  });
});

test("exports an evidence matrix as correctly escaped CSV", () => {
  const csv = toEvidenceMatrixCsv(
    [{ title: 'A study, "revised"', authors: ["A, B"], year: 2024, doi: "10.1000/a" }],
    { "doi:10.1000/a": { titleAbstractDecision: "include", titleAbstractReason: "Population, intervention", fullTextRetrieved: true, fullTextDecision: "include" } },
    { "doi:10.1000/a": { studyDesign: "RCT", outcomes: "Primary outcome\nSecondary outcome" } },
    {}
  );
  assert.match(csv, /"A study, ""revised"""/);
  assert.match(csv, /"A, B"/);
  assert.match(csv, /"Population, intervention"/);
  assert.match(csv, /"Primary outcome\nSecondary outcome"/);
});
