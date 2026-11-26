import test from "node:test";
import assert from "node:assert/strict";
import {
  APPRAISAL_TEMPLATES, createAppraisalRecord, createExtractionRecord,
  evidencePaperKey, summarizeAppraisal, switchAppraisalTemplate, upsertEvidenceRecord, validateEvidenceEntry
} from "../src/domain/evidence-appraisal.mjs";

test("uses normalized DOI as a stable evidence record key and falls back to Unicode title", () => {
  assert.equal(evidencePaperKey({ title: "A study", doi: "https://doi.org/10.1000/ABC" }), "doi:10.1000/abc");
  assert.equal(evidencePaperKey({ title: "Étude médicale" }), "title:étude médicale");
  assert.equal(evidencePaperKey({ title: "A study: with punctuation!" }), "title:a study with punctuation");
  assert.equal(evidencePaperKey({ url: "https://example.org/paper?id=ignored" }), "url:https://example.org/paper");
  assert.equal(evidencePaperKey({}), "");
});

test("creates framework-specific appraisal domains without pre-judging a study", () => {
  const record = createAppraisalRecord({ title: "Trial" }, "RoB 2 (randomized trials)");
  assert.equal(record.domains.length, 5);
  assert.ok(record.domains.every(domain => domain.judgement === "not-assessed" && domain.rationale === ""));
  assert.equal(APPRAISAL_TEMPLATES["ROBINS-I (non-randomized interventions)"].length, 7);
  assert.equal(createAppraisalRecord({ title: "Survey" }, "JBI analytical cross-sectional").domains.length, 8);
});

test("preserves protocol, screening and unrelated paper records when updating one paper", () => {
  const existing = {
    protocol: { reviewType: "systematic", population: "Adults" },
    screening: { "doi:10.1/a": { titleAbstractDecision: "include" } },
    extraction: { "doi:10.1/other": { studyDesign: "cohort" } },
    riskOfBias: { "doi:10.1/other": { tool: "JBI", domains: [] } }
  };
  const result = upsertEvidenceRecord(existing, { title: "Study A", doi: "10.1/a" }, {
    extraction: { studyDesign: "randomized trial" }
  }, 123);
  assert.equal(result.key, "doi:10.1/a");
  assert.equal(result.updatedAt, 123);
  assert.deepEqual(result.data.protocol, existing.protocol);
  assert.deepEqual(result.data.screening, existing.screening);
  assert.deepEqual(result.data.extraction["doi:10.1/other"], existing.extraction["doi:10.1/other"]);
  assert.equal(result.data.extraction["doi:10.1/a"].studyDesign, "randomized trial");
  assert.ok(result.data.riskOfBias["doi:10.1/other"]);
});

test("summarizes appraisal without converting judgments into a quality score", () => {
  const summary = summarizeAppraisal({ domains: [
    { judgement: "low" }, { judgement: "some-concerns" }, { judgement: "high" }, { judgement: "not-assessed" }
  ]});
  assert.deepEqual(summary, { total: 4, assessed: 3, remaining: 1, completed: false, high: 1, concerns: 1 });
});

test("requires a reasoned rationale for assessed domains and at least one extraction detail", () => {
  const extraction = createExtractionRecord();
  const appraisal = createAppraisalRecord({ title: "Study" });
  assert.deepEqual(validateEvidenceEntry(extraction, appraisal), ["Add at least one extracted study detail before saving."]);
  extraction.studyDesign = "Randomized trial";
  appraisal.domains[0].judgement = "low";
  assert.deepEqual(validateEvidenceEntry(extraction, appraisal), ["Add a rationale for each assessed domain."]);
  appraisal.domains[0].rationale = "Allocation was concealed according to the methods section.";
  assert.deepEqual(validateEvidenceEntry(extraction, appraisal), []);
});


test("switching appraisal templates preserves earlier domain judgments and rationales", () => {
  const original = createAppraisalRecord({ title: "Trial" }, "RoB 2 (randomized trials)");
  original.domains[0].judgement = "low";
  original.domains[0].rationale = "Allocation was concealed.";
  const robins = switchAppraisalTemplate(original, { title: "Trial" }, "ROBINS-I (non-randomized interventions)");
  assert.equal(robins.tool, "ROBINS-I (non-randomized interventions)");
  assert.equal(robins.domains.length, 7);
  const restored = switchAppraisalTemplate(robins, { title: "Trial" }, "RoB 2 (randomized trials)");
  assert.equal(restored.domains[0].judgement, "low");
  assert.equal(restored.domains[0].rationale, "Allocation was concealed.");
});
