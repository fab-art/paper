import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workspace = readFileSync("frontend/src/components/ProjectWorkspace.tsx", "utf8");
const evidenceUi = readFileSync("frontend/src/components/ResearchEvidenceWorkspace.tsx", "utf8");
const evidenceCss = readFileSync("frontend/src/components/research-evidence-workspace.css", "utf8");
const styles = readFileSync("frontend/src/styles.css", "utf8");
const projectCss = readFileSync("frontend/src/components/project-workspace.css", "utf8");

test("Evidence Intelligence is reachable from the project workspace without replacing existing stations", () => {
  assert.match(workspace, /ResearchEvidenceWorkspace/);
  assert.match(workspace, /section === "evidence"/);
  for (const section of ["overview", "library", "discover", "review", "methods", "submission", "production"]) {
    assert.ok(workspace.includes(section), "existing project section missing: " + section);
  }
});

test("Evidence UI uses installed Lumen React primitives and accessible controls", () => {
  assert.match(evidenceUi, /from "@santi020k\/lumen-react"/);
  for (const primitive of ["Badge", "Button", "Card", "Progress"]) assert.ok(evidenceUi.includes(primitive));
  assert.match(evidenceUi, /aria-label="Evidence and methods sections"/);
  assert.match(evidenceUi, /aria-busy={loading}/);
  assert.match(evidenceUi, /role="alert"/);
  assert.match(evidenceUi, /aria-live="polite"/);
});

test("claims and source passages persist as project-scoped entities with explicit source relationships", () => {
  assert.match(evidenceUi, /createClaimRecord/);
  assert.match(evidenceUi, /createEvidencePassage/);
  assert.match(evidenceUi, /saveResearchEntity/);
  assert.match(evidenceUi, /saveResearchRelation/);
  assert.match(evidenceUi, /relationType: "supports"/);
  assert.match(evidenceUi, /sourceEntityId/);
  assert.match(evidenceUi, /Exact source passage/);
  assert.match(evidenceUi, /Page, table, figure or section/);
});

test("protocol completeness is separate from owner approval, ethics and registration", () => {
  assert.match(evidenceUi, /assessProtocolReadiness/);
  assert.match(evidenceUi, /ready-for-owner-review/);
  assert.match(evidenceUi, /not approved or registered/);
  assert.match(evidenceUi, /Owner approval remains required/);
});

test("evidence workspace adapts to tablet and mobile layouts", () => {
  assert.match(evidenceCss, /@media\(max-width:900px\)/);
  assert.match(evidenceCss, /@media\(max-width:600px\)/);
  assert.match(evidenceCss, /focus/);
});

test("Research Station and Project Workspace use the Lumen warm paper and deep teal semantic palette", () => {
  assert.match(styles, /--canvas:45 24% 95%/);
  assert.match(styles, /--brand:193 79% 26%/);
  assert.match(styles, /body:has\(\.dash-topbar\)/);
  assert.match(projectCss, /--pw-accent:#125b69/);
  assert.match(projectCss, /--pw-bg:#f3f1e9/);
});
