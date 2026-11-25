import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDoi,
  deduplicatePapers,
  migrateReviewRecords,
  updateTitleAbstractDecision,
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

test("clears full-text decisions when title/abstract screening is reset or excluded", () => {
  const record = {
    paperKey: "doi:10.1000/a",
    titleAbstractDecision: "include",
    titleAbstractReason: "Relevant",
    fullTextRetrieved: true,
    fullTextDecision: "include",
    fullTextReason: "Meets full-text criteria",
    notes: "Reviewer notes",
    updatedAt: 100
  };
  const excluded = updateTitleAbstractDecision(record, "exclude", 200);
  assert.equal(excluded.titleAbstractDecision, "exclude");
  assert.equal(excluded.fullTextRetrieved, false);
  assert.equal(excluded.fullTextDecision, "pending");
  assert.equal(excluded.fullTextReason, "");

  const reset = updateTitleAbstractDecision(record, "pending", 201);
  assert.equal(reset.titleAbstractDecision, "pending");
  assert.equal(reset.fullTextRetrieved, false);
  assert.equal(reset.fullTextDecision, "pending");
  assert.equal(reset.fullTextReason, "");

  const maybe = updateTitleAbstractDecision(record, "maybe", 202);
  assert.equal(maybe.fullTextRetrieved, true);
  assert.equal(maybe.fullTextDecision, "include");
});

test("merges decisions from all duplicate aliases before choosing a canonical paper key", () => {
  const papers = [
    { title: "Corrected cohort study" },
    { title: "Corrected cohort study", doi: "10.1000/cohort" }
  ];
  const titleKey = "title:corrected cohort study";
  const existing = {
    [titleKey]: {
      paperKey: titleKey,
      titleAbstractDecision: "pending",
      titleAbstractReason: "",
      fullTextRetrieved: false,
      fullTextDecision: "pending",
      fullTextReason: "",
      notes: "",
      updatedAt: 10
    },
    "doi:10.1000/cohort": {
      paperKey: "doi:10.1000/cohort",
      titleAbstractDecision: "include",
      titleAbstractReason: "Meets eligibility criteria",
      fullTextRetrieved: true,
      fullTextDecision: "include",
      fullTextReason: "Full text confirms eligibility",
      notes: "DOI-keyed reviewer note",
      updatedAt: 20
    }
  };

  const result = syncReviewRecords(papers, existing);
  assert.equal(result.uniquePapers.length, 1);
  assert.equal(result.screening[titleKey].titleAbstractDecision, "include");
  assert.equal(result.screening[titleKey].titleAbstractReason, "Meets eligibility criteria");
  assert.equal(result.screening[titleKey].fullTextDecision, "include");
  assert.equal(result.screening[titleKey].notes, "DOI-keyed reviewer note");
});

test("merges extraction fields and risk-of-bias domains across duplicate paper aliases", () => {
  const papers = [
    { title: "A pragmatic cohort" },
    { title: "A pragmatic cohort", doi: "10.1000/pragmatic" }
  ];
  const titleKey = "title:a pragmatic cohort";
  const extraction = migrateReviewRecords(papers, {
    [titleKey]: { studyDesign: "", sampleSize: "240", setting: "" },
    "doi:10.1000/pragmatic": { studyDesign: "Cluster randomized trial", setting: "Rwanda" }
  });
  assert.equal(extraction[titleKey].studyDesign, "Cluster randomized trial");
  assert.equal(extraction[titleKey].sampleSize, "240");
  assert.equal(extraction[titleKey].setting, "Rwanda");

  const risk = migrateReviewRecords(papers, {
    [titleKey]: { tool: "JBI", domains: [{ id: "random", name: "Randomization", judgement: "low", rationale: "Adequate" }] },
    "doi:10.1000/pragmatic": { tool: "JBI", domains: [{ id: "blind", name: "Blinding", judgement: "high", rationale: "Not blinded" }] }
  });
  assert.equal(risk[titleKey].domains.length, 2);
  assert.equal(risk[titleKey].domains.find(domain => domain.id === "blind").judgement, "high");
});

test("neutralizes spreadsheet formula prefixes in exported CSV cells", () => {
  const csv = toEvidenceMatrixCsv(
    [{ title: "=HYPERLINK(\"https://evil.invalid\",\"Open\")", authors: ["@SUM(1+1)"], year: 2025, doi: "10.1000/formula" }],
    { "doi:10.1000/formula": {
      titleAbstractDecision: "include",
      titleAbstractReason: " +SUM(1,2)",
      fullTextRetrieved: true,
      fullTextDecision: "include",
      fullTextReason: "-1+1"
    } },
    {},
    {}
  );
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes("'@SUM"));
  assert.ok(csv.includes("' +SUM"));
  assert.ok(csv.includes("'-1+1"));
});

test("an explicit title-screening reset wins over older duplicate full-text decisions", () => {
  const paper = { title: "A cross-tab cohort", doi: "10.1000/cross-tab" };
  const key = "doi:10.1000/cross-tab";
  const oldRecord = {
    paperKey: key,
    titleAbstractDecision: "include",
    titleAbstractReason: "Previously eligible",
    fullTextRetrieved: true,
    fullTextDecision: "include",
    fullTextReason: "Previously included",
    updatedAt: 100
  };
  const resetRecord = updateTitleAbstractDecision(oldRecord, "exclude", 200);
  const migrated = migrateReviewRecords([paper], {
    [key]: oldRecord,
    "title:a cross tab cohort": resetRecord
  });
  assert.equal(migrated[key].titleAbstractDecision, "exclude");
  assert.equal(migrated[key].fullTextRetrieved, false);
  assert.equal(migrated[key].fullTextDecision, "pending");
});

test("reconciles legacy full-text state when title screening is pending or excluded", () => {
  const paper = { title: "Legacy inconsistent screening", doi: "10.1000/legacy" };
  for (const decision of ["pending", "exclude"]) {
    const migrated = migrateReviewRecords([paper], {
      "doi:10.1000/legacy": {
        titleAbstractDecision: decision,
        fullTextRetrieved: true,
        fullTextDecision: "include",
        fullTextReason: "Legacy full-text decision",
        updatedAt: 500
      }
    });
    assert.equal(migrated["doi:10.1000/legacy"].fullTextRetrieved, false);
    assert.equal(migrated["doi:10.1000/legacy"].fullTextDecision, "pending");
    assert.equal(migrated["doi:10.1000/legacy"].fullTextReason, "");
  }
});


test("keeps same-title records with conflicting DOIs as separate studies", () => {
  const result = deduplicatePapers([
    { title: "Same article title", doi: "10.1000/first" },
    { title: "Same article title", doi: "10.1000/second" }
  ]);
  assert.equal(result.uniquePapers.length, 2);
  assert.equal(result.duplicatesRemoved, 0);
});

test("does not let a DOI-less title alias bridge two conflicting DOI records", () => {
  const result = deduplicatePapers([
    { title: "Same article title", doi: "10.1000/first" },
    { title: "Same article title" },
    { title: "Same article title", doi: "10.1000/second" }
  ]);
  assert.equal(result.uniquePapers.length, 3);
  assert.equal(result.duplicatesRemoved, 0);
});
