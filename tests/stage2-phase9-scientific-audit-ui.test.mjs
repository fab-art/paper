import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component = readFileSync(new URL("../frontend/src/components/ScientificAuditWorkspace.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../frontend/src/components/ProjectWorkspace.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../frontend/src/components/scientific-audit.css", import.meta.url), "utf8");

test("Scientific Auditor is reachable from the project workspace", () => {
  assert.match(workspace, /ScientificAuditWorkspace project=\{project\}/);
  assert.match(workspace, /setSection\("auditor"\)/);
});

test("audit reports are stored as local project research records", () => {
  assert.match(component, /listResearchEntities/);
  assert.match(component, /saveResearchEntity/);
  assert.match(component, /recordType: "scientific-audit-report"/);
  assert.doesNotMatch(component, /supabase|fetch\s*\(/i);
});

test("reviewer simulation and journal fit are explicitly bounded", () => {
  assert.match(component, /Simulation only/);
  assert.match(component, /not a real peer review/i);
  assert.match(component, /acceptance prediction/i);
  assert.match(component, /Not provided/);
  assert.match(component, /Save journal profile/);
});

test("audit interface includes accessible status and responsive layouts", () => {
  assert.match(component, /role="alert"/);
  assert.match(component, /role="status"/);
  assert.match(component, /aria-label="Scientific quality tools"/);
  assert.match(styles, /@media\(max-width:600px\)/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
});

test("audit actions never directly rewrite the manuscript", () => {
  assert.doesNotMatch(component, /saveProject\s*\(/);
  assert.doesNotMatch(component, /project\.latex\s*=/);
});


test("reviewer simulation is visibly disclosed as not being real peer review", () => {
  assert.match(component, /Simulated reviewer checklist/);
  assert.match(component, /not a real peer review/i);
});
