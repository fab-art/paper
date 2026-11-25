import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Research GPS persists the selected entry path and starts at the matching route", async () => {
  const dashboard = await readFile(new URL("../frontend/src/components/Dashboard.tsx", import.meta.url), "utf8");
  const workspace = await readFile(new URL("../frontend/src/components/ProjectWorkspace.tsx", import.meta.url), "utf8");
  const line = await readFile(new URL("../frontend/src/components/ResearchProductionLine.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /Where would you like to begin/);
  assert.match(dashboard, /startPath: intake\.startPath/);
  assert.match(workspace, /project=\{project\}/);
  assert.match(line, /getResearchNextAction\(project, researchPlan\)/);
});

test("Writing Studio stages grounded drafts and requires explicit owner acceptance", async () => {
  const studio = await readFile(new URL("../frontend/src/components/Studio.tsx", import.meta.url), "utf8");
  const prompts = await readFile(new URL("../frontend/src/agents/prompts.ts", import.meta.url), "utf8");
  assert.match(studio, /buildGroundedWritingContext/);
  assert.match(studio, /setWritingProposal\(latex\)/);
  assert.match(studio, /Accept proposal/);
  assert.match(studio, /Reject proposal/);
  assert.match(prompts, /\[EVIDENCE:/);
  assert.match(prompts, /\[SOURCE NEEDED\]/);
});

test("Data & Methods exposes design-aware recommendations, study-specific checklist and local fingerprinted manifests", async () => {
  const lab = await readFile(new URL("../frontend/src/components/DataMethodsLab.tsx", import.meta.url), "utf8");
  assert.match(lab, /recommendStatisticalOptions/);
  assert.match(lab, /getStudyComplianceChecklist/);
  assert.match(lab, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(lab, /saveResearchEntity\(entity\)/);
  assert.match(lab, /not evidence that the analysis has been executed or validated/);
});

test("Research GPS persists the editable blueprint plan, story arc and milestones in the shared project", async () => {
  const editor = await readFile(new URL("../frontend/src/components/ResearchPlanEditor.tsx", import.meta.url), "utf8");
  const production = await readFile(new URL("../frontend/src/components/ResearchProductionLine.tsx", import.meta.url), "utf8");
  const types = await readFile(new URL("../frontend/src/lib/types.ts", import.meta.url), "utf8");
  assert.match(editor, /Research story arc/);
  assert.match(editor, /Milestones and target dates/);
  assert.match(editor, /moveResearchPlanStation/);
  assert.match(production, /onProjectUpdate\(\{ researchPlan: nextPlan, milestones: nextPlan\.milestones \}\)/);
  assert.match(production, /onStoryArcChange=\{storyArc => onProjectUpdate\(\{ storyArc \}\)\}/);
  assert.match(types, /researchPlan\?: import\("\.\/research-intake"\)\.ResearchStationPlan/);
});

test("Writing Studio drafts one section at a time with author voice, word targets and claim/citation audits", async () => {
  const studio = await readFile(new URL("../frontend/src/components/Studio.tsx", import.meta.url), "utf8");
  const guidance = await readFile(new URL("../frontend/src/lib/writing-guidance.ts", import.meta.url), "utf8");
  assert.match(studio, /Draft one block at a time/);
  assert.match(studio, /selectedWritingSection/);
  assert.match(studio, /writingWordTarget/);
  assert.match(studio, /authorVoice/);
  assert.match(studio, /writingMicroPrompt/);
  assert.match(studio, /buildWritingBlockPrompt/);
  assert.match(studio, /checkCitationKeys/);
  assert.match(studio, /inspectDraftEvidence/);
  assert.match(studio, /Refresh evidence/);
  assert.match(studio, /Clarity edits are proposed, not applied/);
  assert.match(guidance, /sentenceStarters/);
  assert.match(guidance, /defaultWordTarget/);
  assert.match(guidance, /not in the available evidence set/);
});

test("Writing Studio loads source-linked evidence for the project before enabling grounded writing", async () => {
  const studio = await readFile(new URL("../frontend/src/components/Studio.tsx", import.meta.url), "utf8");
  assert.match(studio, /Promise\.all\(\[loadProject\(projectId\), evidencePromise\]\)/);
  assert.match(studio, /setResearchEntities\(entities\)/);
});

test("Writing Studio drafts only the selected section and stages clarity refinements instead of applying them", async () => {
  const studio = await readFile(new URL("../frontend/src/components/Studio.tsx", import.meta.url), "utf8");
  const start = studio.indexOf("const runWriting = async () =>");
  const end = studio.indexOf("const acceptWritingProposal", start);
  const writingRun = studio.slice(start, end);
  const refineStart = studio.indexOf("const runRefine = async () =>");
  const refineEnd = studio.indexOf("const runAgent", refineStart);
  const refineRun = studio.slice(refineStart, refineEnd);
  assert.match(writingRun, /selectedWritingSection/);
  assert.match(writingRun, /buildWritingBlockPrompt/);
  assert.doesNotMatch(writingRun, /for\s*\(const section of sections\)/);
  assert.match(refineRun, /setWritingProposal/);
  assert.doesNotMatch(refineRun, /patch\(\{ latex:/);
  assert.match(studio, /projectRef\.current\.id !== project\.id/);
  assert.match(studio, /setResearchEntities\(\[\]\)/);
});

test("Writing Studio exposes explicit plain-language-to-academic refinement and keeps revisions staged", async () => {
  const studio = await readFile(new URL("../frontend/src/components/Studio.tsx", import.meta.url), "utf8");
  const prompts = await readFile(new URL("../frontend/src/agents/prompts.ts", import.meta.url), "utf8");
  assert.match(studio, /Plain language to academic prose/);
  assert.match(studio, /refinePrompt\(project, refinementFocus, authorVoice\)/);
  assert.match(prompts, /Convert plain-language, informal or note-like passages into clear academic prose/);
  assert.match(studio, /disabled=\{busy\} onClick=\{acceptWritingProposal\}/);
});

test("Data & Methods executes local descriptive analysis and persists reviewable outputs", async () => {
  const lab = await readFile(new URL("../frontend/src/components/DataMethodsLab.tsx", import.meta.url), "utf8");
  const worker = await readFile(new URL("../frontend/src/components/research-analysis-worker.ts", import.meta.url), "utf8");
  assert.match(lab, /Run a reproducible descriptive analysis/);
  assert.match(lab, /new Worker\(new URL\("\.\/research-analysis-worker\.ts"/);
  assert.match(lab, /datasetFingerprint/);
  assert.match(lab, /Approve result for grounded writing/);
  assert.match(lab, /Download table CSV/);
  assert.match(lab, /Download figure SVG/);
  assert.match(worker, /executeDescriptiveAnalysis/);
});

test("Data & Methods stores owner compliance declarations separately from automated checks", async () => {
  const lab = await readFile(new URL("../frontend/src/components/DataMethodsLab.tsx", import.meta.url), "utf8");
  assert.match(lab, /confirmed-by-researcher/);
  assert.match(lab, /requires-follow-up/);
  assert.match(lab, /recordType: "compliance-review"/);
  assert.match(lab, /not independent verification or certification/);
  assert.match(lab, /Save owner review locally/);
});
