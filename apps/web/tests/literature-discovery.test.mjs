import test from "node:test";
import assert from "node:assert/strict";
import { appendMissingBibtex, deduplicatePapers, normalizeDoi, normalizePaperTitle, paperToBibtex, safeExternalUrl, samePaper } from "../src/domain/literature-discovery.mjs";

test("normalizes DOI URLs, prefixes, case and trailing punctuation", () => {
  assert.equal(normalizeDoi("https://dx.doi.org/10.1000/ABC."), "10.1000/abc");
  assert.equal(normalizeDoi(" DOI: 10.1000/ABC "), "10.1000/abc");
});

test("normalizes Unicode paper titles without losing non-Latin letters", () => {
  assert.equal(normalizePaperTitle("  Café—Study! "), normalizePaperTitle("cafe\u0301 study"));
  assert.equal(normalizePaperTitle("Étude médicale"), normalizePaperTitle("étude médicale"));
});

test("identifies duplicate papers by DOI or normalized title", () => {
  assert.equal(samePaper({ title: "Different title", doi: "10.1000/x" }, { title: "Other", doi: "https://doi.org/10.1000/X" }), true);
  assert.equal(samePaper({ title: "A Clinical Trial!" }, { title: "a clinical trial" }), true);
  assert.equal(samePaper({ title: "One paper" }, { title: "Another paper" }), false);
});

test("deduplicates results while retaining richer metadata and unique authors", () => {
  const result = deduplicatePapers([
    { title: "A Study", authors: ["A Author"], source: "manual" },
    { title: "a-study", authors: ["A Author", "B Author"], doi: "10.1/x", abstract: "Abstract", source: "semantic-scholar" }
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].doi, "10.1/x");
  assert.equal(result[0].abstract, "Abstract");
  assert.deepEqual(result[0].authors, ["A Author", "B Author"]);
  assert.equal(result[0].source, "manual");
});

test("only accepts HTTP and HTTPS external links", () => {
  assert.equal(safeExternalUrl("https://example.org/paper"), "https://example.org/paper");
  assert.equal(safeExternalUrl("javascript:alert(1)"), "");
  assert.equal(safeExternalUrl("not a url"), "");
});

test("creates a BibTeX entry from supplied metadata without inventing fields", () => {
  const bib = paperToBibtex({ title: "R&D in health", authors: ["Jane Doe"], year: 2024, doi: "10.1/x" });
  assert.match(bib, /@article\{doe2024/);
  assert.match(bib, /title = \{R\\&D in health\}/);
  assert.match(bib, /doi = \{10.1\/x\}/);
  assert.doesNotMatch(bib, /journal =/);
});

test("appends BibTeX only for references not already represented by title or DOI", () => {
  const existing = "@article{doe2024,\n title = {A Study},\n doi = {10.1/a}\n}";
  const result = appendMissingBibtex(existing, [
    { title: "a-study", doi: "10.1/a", authors: ["Jane Doe"] },
    { title: "A New Study", authors: ["John Smith"], year: 2025 }
  ]);
  assert.equal((result.match(/@article\{/g) ?? []).length, 2);
  assert.match(result, /A New Study/);
});
