import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync(new URL("../frontend/src/components/Dashboard.tsx", import.meta.url), "utf8");
const authPanel = readFileSync(new URL("../frontend/src/components/AuthPanel.tsx", import.meta.url), "utf8");
const projectWorkspace = readFileSync(new URL("../frontend/src/components/ProjectWorkspace.tsx", import.meta.url), "utf8");
const systematicReview = readFileSync(new URL("../frontend/src/components/SystematicReviewWorkspace.tsx", import.meta.url), "utf8");
const dataMethodsLab = readFileSync(new URL("../frontend/src/components/DataMethodsLab.tsx", import.meta.url), "utf8");
const dataMethodsStyles = readFileSync(new URL("../frontend/src/components/data-methods-lab.css", import.meta.url), "utf8");
const styles = readFileSync(new URL("../frontend/src/styles.css", import.meta.url), "utf8");

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



test("dashboard project-grid conditional has balanced JSX fragments", () => {
  assert.equal(dashboard.includes("</div>}</>}"), false);
});

test("project workspace milestone controls and progress expose accessible names and values", () => {
  assert.ok(projectWorkspace.includes("aria-label={`Mark ${item.title} complete`}"));
  assert.ok(projectWorkspace.includes("aria-label={`Remove milestone ${item.title}`}"));
  assert.ok(projectWorkspace.includes('role="progressbar" aria-label="Milestone completion"'));
  assert.ok(projectWorkspace.includes("aria-valuenow={milestoneProgress}"));
});

test("project library icon actions identify their target", () => {
  assert.ok(projectWorkspace.includes("aria-label={`Remove reference ${paper.title}`}"));
  assert.ok(projectWorkspace.includes("aria-label={`Download ${file.name}`}"));
  assert.ok(projectWorkspace.includes("aria-label={`Delete ${file.name}`}"));
  assert.ok(projectWorkspace.includes('aria-label="Close add reference form"'));
});

test("clearing project reference search restores keyboard focus to the search field", () => {
  assert.ok(projectWorkspace.includes("sourceSearchRef"));
  assert.ok(projectWorkspace.includes("sourceSearchRef.current?.focus()"));
  assert.ok(projectWorkspace.includes("clearSourceSearch"));
  assert.ok(projectWorkspace.includes('aria-label="Clear reference search"'));
});

test("systematic review tab uses an imported icon", () => {
  const iconImport = projectWorkspace.slice(0, projectWorkspace.indexOf('from "lucide-react"'));
  assert.ok(iconImport.includes("ClipboardCheck"));
});


test("dashboard clear-search actions return focus to the persistent search input", () => {
  assert.match(dashboard, /ref={searchInputRef} aria-label="Search projects"/);
  assert.match(dashboard, /const clearProjectSearch = \(\) => \{\s*setQuery\("+"\);\s*searchInputRef\.current\?\.focus\(\);/);
  assert.match(dashboard, /aria-label="Clear project search" onClick={clearProjectSearch}/);
  assert.match(dashboard, /className="dash-empty-clear" onClick={clearProjectSearch}/);
});

test("dashboard search placeholder uses an explicit readable light-theme color", () => {
  assert.match(styles, /\.dash-search input::placeholder\s*\{\s*color:#6b6e77;opacity:1\s*\}/);
});


test("systematic review section switcher has toggle-group semantics and explicit button types", () => {
  assert.match(systematicReview, /role="group" aria-label="Systematic review sections"/);
  assert.match(systematicReview, /type="button" key={id}/);
  assert.match(systematicReview, /aria-pressed={tab===id}/);
});

test("screening search can be cleared with focus restored to its input", () => {
  assert.match(systematicReview, /screeningSearchRef/);
  assert.match(systematicReview, /screeningSearchRef\.current\?\.focus\(\)/);
  assert.match(systematicReview, /aria-label="Clear screening search"/);
  assert.match(systematicReview, /clearScreeningFilters/);
});

test("risk-of-bias domain removal names its study and domain", () => {
  assert.ok(systematicReview.includes('aria-label={`Remove ${domain.name || "unnamed"} domain for ${paper.title}`}'));
});

test("risk-of-bias domain actions use migrated records so identifier upgrades do not hide edits", () => {
  assert.match(systematicReview, /const current = migratedRiskOfBias\[key\] \|\| \{ tool: "JBI", domains: \[\] \};/);
  assert.match(systematicReview, /const current = migratedRiskOfBias\[key\];\s*if \(current\) updateRisk\(key, \{ domains: current\.domains\.filter/);
});


test("data methods loading state and dataset region expose busy and status semantics", () => {
  assert.match(dataMethodsLab, /aria-busy={loading}/);
  assert.match(dataMethodsLab, /className="dml-loading" role="status" aria-live="polite"/);
  assert.match(dataMethodsLab, /className="dml-error" role="alert"/);
});

test("data methods variable filter has a clear action that restores focus", () => {
  assert.match(dataMethodsLab, /variableFilterRef/);
  assert.match(dataMethodsLab, /variableFilterRef\.current\?\.focus\(\)/);
  assert.match(dataMethodsLab, /aria-label="Filter variables"/);
  assert.match(dataMethodsLab, /aria-label="Clear variable filter"/);
  assert.match(dataMethodsLab, /Clear variable filter/);
});

test("data methods tables have captions, column scopes and keyboard-scrollable regions", () => {
  assert.match(dataMethodsLab, /<caption className="dml-visually-hidden">Variable profile/);
  assert.match(dataMethodsLab, /<caption className="dml-visually-hidden">First eight records/);
  assert.match(dataMethodsLab, /<th scope="col">Variable<\/th>/);
  assert.match(dataMethodsLab, /role="region" aria-label="Variable profile table" tabIndex={0}/);
  assert.match(dataMethodsLab, /role="region" aria-label="Data preview table" tabIndex={0}/);
});

test("data methods result and truncation summaries are announced to assistive technology", () => {
  assert.match(dataMethodsLab, /className="dml-counts" role="status" aria-live="polite"/);
  assert.match(dataMethodsLab, /className="dml-warning" role="status"/);
});

test("data methods filter recovery and reduced-motion styling are present", () => {
  assert.match(dataMethodsStyles, /\.dml-clear-filter/);
  assert.match(dataMethodsStyles, /\.dml-visually-hidden/);
  assert.match(dataMethodsStyles, /prefers-reduced-motion:reduce/);
});
