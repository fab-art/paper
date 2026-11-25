import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

 test('Lumen React and its runtime packages are pinned to one verified release', async () => {
  const manifest = JSON.parse(await read('frontend/package.json'));
  const lock = JSON.parse(await read('frontend/package-lock.json'));
  assert.equal(manifest.dependencies['@santi020k/lumen-react'], '4.3.0');
  assert.equal(manifest.overrides['@santi020k/lumen'], '4.3.0');
  assert.equal(manifest.overrides['@santi020k/lumen-core'], '4.3.0');
  for (const name of ['@santi020k/lumen-react', '@santi020k/lumen', '@santi020k/lumen-core']) {
    const resolved = Object.entries(lock.packages).filter(([path]) => path.endsWith(`node_modules/${name}`));
    assert.ok(resolved.length > 0, `${name} must appear in the lockfile`);
    assert.ok(resolved.every(([, pkg]) => pkg.version === '4.3.0'), `${name} must resolve only to 4.3.0`);
  }
});

test('Lumen styles load before PaperOrchestra overrides', async () => {
  const main = await read('frontend/src/main.tsx');
  assert.match(main, /import ["']@santi020k\/lumen-react\/styles\.css["'];/);
  assert.ok(main.indexOf('@santi020k/lumen-react/styles.css') < main.indexOf('./styles.css'));
});

test('dashboard uses Lumen primitives without replacing IndexedDB project operations', async () => {
  const dashboard = await read('frontend/src/components/Dashboard.tsx');
  assert.match(dashboard, /from ["']@santi020k\/lumen-react["']/);
  assert.match(dashboard, /<Button\b/);
  assert.match(dashboard, /<Card\b/);
  assert.match(dashboard, /<Badge\b/);
  assert.match(dashboard, /<Progress\b/);
  for (const operation of ['listProjects', 'saveProject', 'restoreProject', 'deleteProjectAndData']) {
    assert.match(dashboard, new RegExp(`\\b${operation}\\b`));
  }
});

test('dashboard shell remains usable at narrow viewport widths', async () => {
  const styles = await read('frontend/src/styles.css');
  assert.match(styles, /body:has\(\.dashboard-shell\)[^{]*\{[^}]*min-width:320px/s);
  assert.match(styles, /\.dashboard-shell\s*\{[^}]*min-width:0/s);
  assert.match(styles, /@media\s*\(max-width:\s*580px\)/);
  assert.match(styles, /\.dash-modal\s*\{[^}]*box-sizing:border-box/s);
  assert.match(styles, /\.dash-modal-backdrop\s*\{[^}]*padding:12px/s);
  const mobileRules = styles.slice(styles.lastIndexOf('@media(max-width:580px)'));
  assert.match(mobileRules, /\.dash-modal input[^}]*font-size:16px/s);
});
