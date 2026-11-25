import test from "node:test";
import assert from "node:assert/strict";
import {
  getWritingSectionGuide,
  buildWritingBlockPrompt,
  inspectDraftEvidence,
  checkCitationKeys
} from "../frontend/src/lib/writing-guidance.ts";
import { refinePrompt } from "../frontend/src/agents/prompts.ts";

const project = {
  id: "p1", name: "Study", notes: "Research context", latex: "\\documentclass{article}\\n\\begin{document}\\n\\end{document}",
  bibtex: "@article{known2024, title={Known Study}}", template: "Generic Article", outline: [],
  papers: [], figures: [], logs: "", agentRecords: [], updatedAt: 1, paperType: "empirical-study"
};
const section = { id: "methods", title: "Methods", description: "Explain the study methods." };

test("section guide gives plain-language purpose, micro-prompts, starters and a word target", () => {
  const guide = getWritingSectionGuide("Methods", "empirical-study");
  assert.match(guide.purpose, /how the study was designed/i);
  assert.ok(guide.microPrompts.length >= 3);
  assert.ok(guide.sentenceStarters.length >= 2);
  assert.ok(guide.defaultWordTarget > 0);
});

test("writing block prompt carries word target, focused micro-prompt, author voice and evidence rules", () => {
  const prompt = buildWritingBlockPrompt(project, section, "PASSAGE [ev-1]", {
    wordTarget: 520, authorVoice: "preserve", microPrompt: "Explain the sampling approach."
  });
  assert.match(prompt, /520 words/i);
  assert.match(prompt, /Explain the sampling approach/);
  assert.match(prompt, /preserve the author's existing voice/i);
  assert.match(prompt, /\[SOURCE NEEDED\]/);
  assert.match(prompt, /PASSAGE \[ev-1\]/);
});

test("draft evidence audit maps markers to exact available evidence and flags unknown or unsupported claims", () => {
  const audit = inspectDraftEvidence(
    "The intervention improved the outcome. [EVIDENCE: ev-1]\\nA second claim is uncertain. [EVIDENCE: missing-id]\\nNo source for this claim. [SOURCE NEEDED]",
    ["ev-1"]
  );
  assert.equal(audit.linked.length, 1);
  assert.equal(audit.unresolved.length, 2);
  assert.equal(audit.linked[0].evidenceId, "ev-1");
  assert.equal(audit.linked[0].claim, "The intervention improved the outcome.");
  assert.match(audit.unresolved[0].reason, /not in the available evidence set/i);
  assert.match(audit.unresolved[1].reason, /source needed/i);
});

test("citation checker detects missing and unused BibTeX keys without treating metadata as evidence", () => {
  const audit = checkCitationKeys(
    "Prior work supports this. \\cite{known2024,missing2023}",
    "@string{journal = {Example Journal}}\n@article{known2024, title={Known}}\n@article{unused2022, title={Unused}}"
  );
  assert.deepEqual(audit.missingKeys, ["missing2023"]);
  assert.deepEqual(audit.unusedKeys, ["unused2022"]);
  assert.deepEqual(audit.citedKeys, ["known2024", "missing2023"]);
});

test("academic refinement explicitly converts plain language while preserving voice and uncertainty", () => {
  const prompt = refinePrompt(project, "academic", "preserve");
  assert.match(prompt, /Convert plain-language, informal or note-like passages into clear academic prose/);
  assert.match(prompt, /Preserve the author's existing voice/);
  assert.match(prompt, /Preserve all factual uncertainty/);
});
