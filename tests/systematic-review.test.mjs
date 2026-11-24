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
    { title: "Different title, same DOI", authors: ["E"] }
  ]);
  assert.equal(result.uniquePapers.length, 2);
  assert.equal(result.duplicatesRemoved, 3);
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


test("preserves screening decisions when a title-keyed paper later receives a DOI", () => {
  const original = [{ title: "A longitudinal study of diabetes care" }];
  const first = syncReviewRecords(original, {});
  const oldKey = "title:a longitudinal study of diabetes care";
  const existing = {
    ...first.screening,
    [oldKey]: {
      ...first.screening[oldKey],
      titleAbstractDecision: "include",
      titleAbstractReason: "Meets the population criteria"
    }
  };

  const enriched = syncReviewRecords([
    { title: "A longitudinal study of diabetes care", doi: "10.1000/diabetes.1" }
  ], existing);

  assert.equal(enriched.screening["doi:10.1000/diabetes.1"].titleAbstractDecision, "include");
  assert.equal(enriched.screening["doi:10.1000/diabetes.1"].titleAbstractReason, "Meets the population criteria");
});

test("migrates title-keyed screening decisions when DOI metadata is added through a duplicate alias", () => {
  const papers = [
    { title: "A cohort study", doi: "10.1000/cohort" },
    { title: "A cohort study" }
  ];
  const existing = {
    "title:a cohort study": {
      paperKey: "title:a cohort study",
      titleAbstractDecision: "exclude",
      titleAbstractReason: "Wrong study design",
      fullTextRetrieved: false,
      fullTextDecision: "pending",
      fullTextReason: "",
      notes: "",
      updatedAt: 1
    }
  };

  const result = syncReviewRecords(papers, existing);
  assert.equal(result.screening["doi:10.1000/cohort"].titleAbstractDecision, "exclude");
  assert.equal(result.screening["doi:10.1000/cohort"].titleAbstractReason, "Wrong study design");
});


test("migrates extraction and risk-of-bias records with a paper's canonical review key", async () => {
  const { migrateReviewRecords } = await import("../frontend/src/lib/systematic-review.mjs");
  const papers = [{ title: "A pragmatic trial", doi: "10.1000/pragmatic" }];
  const oldKey = "title:a pragmatic trial";
  const migrated = migrateReviewRecords(papers, {
    [oldKey]: { studyDesign: "Cluster randomized trial", sampleSize: "240" }
  });

  assert.deepEqual(migrated, {
    "doi:10.1000/pragmatic": { studyDesign: "Cluster randomized trial", sampleSize: "240" }
  });
});
