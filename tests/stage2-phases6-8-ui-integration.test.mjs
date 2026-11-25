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
