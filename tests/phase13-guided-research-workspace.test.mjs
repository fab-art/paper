import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync('frontend/src/components/Dashboard.tsx', 'utf8');
const workspace = readFileSync('frontend/src/components/ProjectWorkspace.tsx', 'utf8');
const production = readFileSync('frontend/src/components/ResearchProductionLine.tsx', 'utf8');
const productionCss = readFileSync('frontend/src/components/research-production-line.css', 'utf8');
const executor = readFileSync('frontend/src/lib/research-agent-executor.ts', 'utf8');
const db = readFileSync('frontend/src/lib/db.ts', 'utf8');
const packageJson = JSON.parse(readFileSync('frontend/package.json', 'utf8'));

test('guided Research GPS is a three-step plain-language intake with paper-type blueprints', () => {
  assert.match(dashboard, /STEP \{intakeStep\+1\} OF 3/);
  assert.match(dashboard, /1 · Your idea/);
  assert.match(dashboard, /2 · Your materials/);
  assert.match(dashboard, /3 · Review/);
  assert.match(dashboard, /PAPER_TYPE_BLUEPRINTS/);
  assert.match(dashboard, /Draft research story arc/);
  assert.match(dashboard, /not an approved protocol/);
  assert.match(dashboard, /remain yours to approve/);
});

test('Project Workspace exposes the Research Production Line without replacing existing workspaces', () => {
  assert.match(workspace, /ResearchProductionLine/);
  assert.match(workspace, /Production line/);
  for (const section of ['overview', 'library', 'discover', 'review', 'methods', 'submission']) {
    assert.ok(workspace.includes(section), `existing workspace section missing: ${section}`);
  }
});

test('Production Line uses the installed Lumen React primitives and progressive disclosure', () => {
  assert.match(production, /from "@santi020k\/lumen-react"/);
  for (const component of ['Button', 'Card', 'Badge', 'Progress']) assert.ok(production.includes(component));
  assert.match(production, /researchMode === "guided"/);
  assert.match(production, /researchMode === "professional"/);
  assert.match(production, /onModeChange/);
});

test('Production Line exposes dependency gates, agent assignment, owner approval and pause controls', () => {
  assert.match(production, /dependencyTaskIds/);
  assert.match(production, /Assign specialist/);
  assert.match(production, /ownerApprovalRequired: ownerGate \|\| Boolean\(agentId\)/);
  assert.match(production, /Approve/);
  assert.match(production, /Approve to start/);
  assert.match(production, /Request changes/);
  assert.match(production, /setResearchAgentsPaused/);
  assert.match(production, /Run specialist/);
  assert.match(production, /Inspect specialist output/);
  assert.match(production, /open=\{task\.status === "awaiting-owner"\}/);
});

test('specialist execution uses local WebLLM, saves proposed provenance and waits for owner review', () => {
  assert.match(executor, /complete\(prompt\)/);
  assert.match(executor, /getEngine\(\)/);
  assert.match(executor, /entityType: "research-note"/);
  assert.match(executor, /status: "proposed"/);
  assert.match(executor, /kind: "agent"/);
  assert.match(executor, /"submit", "agent"/);
  assert.match(executor, /ownerApprovalRequired: true/);
});

test('research task persistence validates linked inputs and outputs and records an audit trail', () => {
  assert.match(db, /Every task input must reference an existing research entity/);
  assert.match(db, /db\.researchAuditEvents, db\.researchEntities/);
  assert.match(db, /Every task output must reference an existing research entity/);
  assert.match(db, /not authorized for this research station/);
  assert.match(db, /Agent outputs can only be saved by the assigned specialist/);
  assert.match(db, /A specialist can submit only its own proposed outputs/);
  assert.match(db, /actor === "agent" && action === "start" && control\?\.agentsPaused/);
  assert.match(db, /task.approvalStage === "after-run"/);
  assert.match(db, /status: action === "approve" \? "approved" : "stale"/);
  assert.match(production, /Status: \{entity\?\.status/);
  assert.match(db, /researchAuditEvents/);
  assert.match(db, /listResearchAuditEvents/);
});

test('production line layout responds to smaller viewports and reduced motion', () => {
  assert.match(productionCss, /@media\(max-width:1050px\)/);
  assert.match(productionCss, /@media\(max-width:680px\)/);
  assert.match(productionCss, /prefers-reduced-motion:reduce/);
});

test('Vercel frontend build runs regression tests before typecheck and bundling', () => {
  assert.equal(packageJson.scripts.prebuild, 'npm --prefix .. run test:regression');
  assert.match(packageJson.scripts.build, /tsc -b && vite build/);
});
