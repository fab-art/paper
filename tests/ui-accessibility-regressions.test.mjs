import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync(new URL("../frontend/src/components/Dashboard.tsx", import.meta.url), "utf8");
const authPanel = readFileSync(new URL("../frontend/src/components/AuthPanel.tsx", import.meta.url), "utf8");
const projectWorkspace = readFileSync(new URL("../frontend/src/components/ProjectWorkspace.tsx", import.meta.url), "utf8");

test("project search has an explicit accessible name", () => {
  assert.match(dashboard, /<input[^>]*aria-label=["']Search projects["']/s);
});

test("create-project overlay exposes a named, described modal dialog", () => {
  assert.match(dashboard, /role=["']dialog["']/);
  assert.match(dashboard, /aria-modal={true}/);
  assert.match(dashboard, /aria-labelledby=["']dash-create-title["']/);
  assert.match(dashboard, /aria-describedby=["']dash-create-description["']/);
});

test("create-project dialog supports Escape and keeps keyboard focus inside", () => {
  assert.match(dashboard, /event\.key\s*===?\s*["']Escape["']/);
  assert.match(dashboard, /event\.key\s*!==\s*["']Tab["']/);
  assert.match(dashboard, /document\.activeElement/);
  assert.match(dashboard, /\.focus\(\)/);
});

test("sign-in dialog has a programmatic description", () => {
  assert.match(authPanel, /aria-describedby=["']cloud-auth-description["']/);
  assert.match(authPanel, /id=["']cloud-auth-description["']/);
});

test("sign-in dialog supports Escape and keeps keyboard focus inside", () => {
  assert.match(authPanel, /event\.key\s*===?\s*["']Escape["']/);
  assert.match(authPanel, /event\.key\s*!==\s*["']Tab["']/);
  assert.match(authPanel, /document\.activeElement/);
  assert.match(authPanel, /\.focus\(\)/);
});

test("closing either dialog restores focus to its opener", () => {
  assert.match(dashboard, /createTriggerRef\.current\?\.focus\(\)/);
  assert.match(authPanel, /signInTriggerRef\.current\?\.focus\(\)/);
});

test("project list switcher uses toggle-group semantics", () => {
  assert.match(dashboard, /role=["']group["'] aria-label=["']Project lists["']/);
  assert.match(dashboard, /aria-pressed={scope === "active"}/);
  assert.doesNotMatch(dashboard, /role=["']tablist["']/);
});

test("sign-in method switcher uses toggle-group semantics", () => {
  assert.match(authPanel, /role=["']group["'] aria-label=["']Sign-in method["']/);
  assert.match(authPanel, /aria-pressed={mode === "magic"}/);
  assert.doesNotMatch(authPanel, /role=["']tablist["']/);
});

test("sign-in dialog keeps a document-level focus guard active during submission", () => {
  assert.match(authPanel, /document\.addEventListener\("keydown", handleDialogKeyDown, true\)/);
  assert.match(authPanel, /!dialog\.contains\(document\.activeElement\)/);
});

test("sign-in restores focus to a stable control after authentication", () => {
  assert.match(authPanel, /signedInControlRef/);
  assert.match(authPanel, /signInTriggerRef\.current \?\? signedInControlRef\.current/);
});

test("sign-out returns focus to the newly rendered sign-in button", () => {
  assert.match(authPanel, /wasSignedInRef/);
  assert.match(authPanel, /wasSignedInRef\.current && !session\?\.user/);
});

test("opening a project moves focus to its project-name control", () => {
  assert.match(projectWorkspace, /ref=\{projectNameRef\}/);
  assert.match(projectWorkspace, /projectNameRef\.current\?\.focus\(\)/);
});

test("successful password and immediate sign-up sessions close the modal before focus restoration", () => {
  const sessionSyncs = authPanel.match(/if \(data\.session\) \{ setSession\(data\.session\); setOpen\(false\); \}/g) || [];
  assert.ok(sessionSyncs.length >= 2);
});


const dashboardStyles = readFileSync(new URL("../frontend/src/styles.css", import.meta.url), "utf8");

test("dashboard reports the number of running agents rather than projects containing them", () => {
  assert.match(dashboard, /const runningAgents = activeProjects\.reduce\(/);
  assert.match(dashboard, /RUNNING AGENTS/);
  assert.match(dashboard, /Across active projects/);
});

test("dashboard workflow progress uses each project's actual stage count", () => {
  assert.match(dashboard, /const totalStages = project\.agentRecords\.length/);
  assert.match(dashboard, /done \/ totalStages/);
  assert.doesNotMatch(dashboard, /done \/ 5/);
});

test("dashboard project search provides a keyboard-accessible clear action", () => {
  assert.match(dashboard, /aria-label=["']Clear project search["']/);
  assert.match(dashboard, /setQuery\(["']["']\)/);
});

test("dashboard announces result changes and gives the user a way out of filtered empty states", () => {
  assert.match(dashboard, /className="dash-results" role="status" aria-live="polite"/);
  assert.match(dashboard, /Clear search/);
});

test("new project name is explicitly required and bounded", () => {
  assert.match(dashboard, /name=["']projectName["']/);
  assert.match(dashboard, /required/);
  assert.match(dashboard, /maxLength=\{100\}/);
});

test("dashboard dark premium palette is scoped to Research Station and responsive", () => {
  const phaseOneStyles = dashboardStyles.slice(dashboardStyles.lastIndexOf("/* Phase 1 — premium dark Research Station */"));
  assert.match(phaseOneStyles, /\.dashboard-shell\s*\{[^}]*--dash-bg:\s*#0f1015/s);
  assert.match(phaseOneStyles, /--dash-surface:/);
  assert.match(phaseOneStyles, /@media\s*\(max-width:\s*720px\)/);
  assert.match(phaseOneStyles, /\.dashboard-shell\s+button:focus-visible/);
});


test("clearing dashboard search keeps keyboard focus in the search field", () => {
  assert.match(dashboard, /const searchInputRef = useRef<HTMLInputElement \| null>\(null\)/);
  assert.match(dashboard, /searchInputRef\.current\?\.focus\(\)/);
  assert.doesNotMatch(dashboard, /<label className=["']dash-search["']/);
});


test("project workspace section navigation is a named toggle group with exposed active state", () => {
  assert.match(projectWorkspace, /role="group" aria-label="Project workspace sections"/);
  assert.match(projectWorkspace, /aria-pressed={section === "overview"}/);
  assert.match(projectWorkspace, /aria-pressed={section === "submission"}/);
});

test("project name is a bounded, semantic page heading", () => {
  assert.match(projectWorkspace, /<h1 className="pw-project-heading">/);
  assert.match(projectWorkspace, /className="pw-project-name"[^>]*maxLength={100}/);
  assert.match(projectWorkspace, /aria-label="Project name"/);
});

test("research library search has a programmatic label and search landmark", () => {
  assert.match(projectWorkspace, /role="search" aria-label="Search project references"/);
  assert.match(projectWorkspace, /aria-label="Search references"/);
});

test("project workspace controls expose visible focus and minimum touch sizing", () => {
  const workspaceStyles = readFileSync(new URL("../frontend/src/components/project-workspace.css", import.meta.url), "utf8");
  assert.match(workspaceStyles, /\.project-workspace :is\(button,\s*a,\s*input,\s*select,\s*textarea\):focus-visible/);
  assert.match(workspaceStyles, /min-height:\s*40px/);
  assert.match(workspaceStyles, /@media\s*\(max-width:\s*560px\)/);
});

test("project workspace narrow layouts avoid page-level horizontal overflow", () => {
  const workspaceStyles = readFileSync(new URL("../frontend/src/components/project-workspace.css", import.meta.url), "utf8");
  assert.match(workspaceStyles, /\.pw-tabs\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(workspaceStyles, /\.pw-overview,\.pw-notes-layout\s*\{\s*grid-template-columns:\s*1fr/s);
  assert.match(workspaceStyles, /\.pw-project-name\s*\{[^}]*max-width:\s*100%/s);
});
