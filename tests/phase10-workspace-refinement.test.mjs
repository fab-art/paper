import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('frontend/src/main.tsx', 'utf8');
const styles = readFileSync('frontend/src/workspace-refinement.css', 'utf8');
const studio = readFileSync('frontend/src/components/Studio.tsx', 'utf8');
const data = readFileSync('frontend/src/components/DataMethodsLab.tsx', 'utf8');
const review = readFileSync('frontend/src/components/SystematicReviewWorkspace.tsx', 'utf8');
const readiness = readFileSync('frontend/src/components/SubmissionReadiness.tsx', 'utf8');

test('workspace refinement stylesheet is loaded by the application', () => {
  assert.match(app, /workspace-refinement\.css/);
});

test('all four specialist workspaces receive consistent surface and control refinements', () => {
  for (const selector of ['.app-shell', '.dml-shell', '.srw-shell', '.sr-shell']) {
    assert.ok(styles.includes(selector), `missing workspace selector ${selector}`);
  }
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /min-width:\s*0/);
  assert.match(styles, /overflow-wrap:\s*anywhere/);
});

test('writing studio exposes named workspace navigation and a responsive three-pane layout', () => {
  assert.match(studio, /className="left-pane"/);
  assert.match(studio, /className="center-pane"/);
  assert.match(studio, /className="right-pane"/);
  assert.match(styles, /\.app-shell/);
  assert.match(styles, /@media/);
});

test('data and methods retains local-only dataset disclosure and accessible result status', () => {
  assert.match(data, /Files remain in this browser/);
  assert.match(data, /role="status"/);
});

test('systematic review retains explicit tab semantics and decision controls', () => {
  assert.match(review, /aria-pressed/);
  assert.match(review, /screening/);
  assert.match(review, /extraction/);
});

test('quality and export retains researcher-controlled confirmations and export status', () => {
  assert.match(readiness, /Researcher confirmation/);
  assert.match(readiness, /aria-live="polite"/);
  assert.match(readiness, /Export submission ZIP/);
});

test('Writing Studio conference template selector has a programmatic name', () => {
  assert.match(studio, /aria-label="Conference manuscript template"/);
});
