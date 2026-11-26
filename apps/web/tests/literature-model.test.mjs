import test from "node:test";
import assert from "node:assert/strict";
import {
  isSavedPaper,
  normalizeDoi,
  normalizePaperTitle,
  safeExternalUrl
} from "../src/features/literature/literatureModel.mjs";

test("normalizes DOI prefixes and resolver URLs consistently", () => {
  assert.equal(normalizeDoi("https://doi.org/10.1000/ABC.123"), "10.1000/abc.123");
  assert.equal(normalizeDoi("http://dx.doi.org/10.1000/ABC.123"), "10.1000/abc.123");
  assert.equal(normalizeDoi("doi: 10.1000/ABC.123"), "10.1000/abc.123");
});

test("normalizes paper titles across punctuation, case and Unicode composition", () => {
  assert.equal(normalizePaperTitle(" Precision Medicine—In Diabetes! "), "precisionmedicineindiabetes");
  assert.equal(normalizePaperTitle("café"), normalizePaperTitle("cafe\u0301"));
});

test("matches saved papers by DOI or normalized title", () => {
  const saved = [
    { title: "Precision Medicine in Diabetes", doi: "10.1000/abc.1" },
    { title: "A Second Study", doi: "10.1000/abc.2" }
  ];
  assert.equal(isSavedPaper({ title: "Different title", doi: "https://doi.org/10.1000/ABC.1" }, saved), true);
  assert.equal(isSavedPaper({ title: "precision medicine in diabetes", doi: "" }, saved), true);
  assert.equal(isSavedPaper({ title: "A new study", doi: "10.1000/abc.3" }, saved), false);
  assert.equal(isSavedPaper({ title: "", doi: "" }, saved), false);
});

test("allows only valid HTTP and HTTPS external paper links", () => {
  assert.equal(safeExternalUrl("https://example.org/paper"), "https://example.org/paper");
  assert.equal(safeExternalUrl("http://example.org/paper"), "http://example.org/paper");
  assert.equal(safeExternalUrl("javascript:alert(1)"), undefined);
  assert.equal(safeExternalUrl("data:text/html,unsafe"), undefined);
  assert.equal(safeExternalUrl("not a URL"), undefined);
  assert.equal(safeExternalUrl(undefined), undefined);
});
