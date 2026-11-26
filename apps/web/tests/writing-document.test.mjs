import test from "node:test";
import assert from "node:assert/strict";
import { insertLatexSection, findUndefinedCitationKeys } from "../src/domain/writing-document.mjs";

test("inserts a new section before bibliography and document end", () => {
  const source = "\\documentclass{article}\n\\begin{document}\nBody\n\\bibliography{references}\n\\end{document}";
  const result = insertLatexSection(source, "Methods", "Describe the methods.");
  assert.ok(result.indexOf("\\section{Methods}") < result.indexOf("\\bibliography{references}"));
  assert.ok(result.includes("Describe the methods."));
  assert.ok(result.endsWith("\\end{document}"));
});

test("replaces the matching section body without deleting the next section", () => {
  const source = "\\section{Methods}\n\\label{sec:methods}\nOld text\n\\section{Results}\nKeep results";
  const result = insertLatexSection(source, "Methods", "Updated methods.");
  assert.ok(result.includes("\\label{sec:methods}"));
  assert.ok(result.includes("Updated methods."));
  assert.ok(!result.includes("Old text"));
  assert.ok(result.includes("\\section{Results}\nKeep results"));
});

test("escapes LaTeX special characters in a newly inserted section title", () => {
  const result = insertLatexSection("\\begin{document}\n\\end{document}", "Cost & Effectiveness", "Text");
  assert.ok(result.includes("\\section{Cost \\& Effectiveness}"));
});

test("reports citation keys that are absent from the supplied BibTeX", () => {
  assert.deepEqual(
    findUndefinedCitationKeys("Prior work \\cite{smith2020,lee2022}.", "@article{smith2020, title={Known}}"),
    ["lee2022"]
  );
});

test("does not flag citations that exist in BibTeX or repeat undefined keys", () => {
  assert.deepEqual(
    findUndefinedCitationKeys("\\citep{known,missing,missing}", "@article{known, title={Known}}"),
    ["missing"]
  );
});
