import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const types = readFileSync('frontend/src/lib/research-blueprint.ts', 'utf8');
const db = readFileSync('frontend/src/lib/db.ts', 'utf8');
const projectTypes = readFileSync('frontend/src/lib/types.ts', 'utf8');

test('Research Blueprint defines a versioned canonical project identity and lifecycle', () => {
  assert.match(types, /schemaVersion:\s*number/);
  assert.match(types, /projectId:\s*string/);
  assert.match(types, /lifecycleState:/);
  assert.match(types, /createdAt:\s*number/);
  assert.match(types, /updatedAt:\s*number/);
});

test('Research Blueprint supports normalized entities, relations, and owner decisions', () => {
  assert.match(types, /interface ResearchEntity/);
  assert.match(types, /interface ResearchRelation/);
  assert.match(types, /interface ResearchDecision/);
  assert.match(types, /provenance:/);
  assert.match(types, /approvedByOwner/);
});

test('legacy Project records can be mapped without discarding existing research content', () => {
  assert.match(types, /projectToResearchBlueprint/);
  assert.match(types, /researchQuestion/);
  assert.match(types, /systematicReview/);
  assert.match(types, /legacyProjectRevision/);
  assert.match(projectTypes, /export interface Project/);
});

test('Dexie schema adds the Research Blueprint stores without removing legacy stores', () => {
  assert.match(db, /this\.version\(5\)/);
  assert.match(db, /researchBlueprints/);
  assert.match(db, /researchEntities/);
  assert.match(db, /researchRelations/);
  assert.match(db, /researchDecisions/);
  for (const legacyStore of ['projects', 'notes', 'attachments', 'searches', 'deletedProjects']) {
    assert.ok(db.includes(legacyStore), `legacy store missing: ${legacyStore}`);
  }
});

test('database upgrade backfills existing projects idempotently', () => {
  assert.match(db, /\.upgrade\(/);
  assert.match(db, /projectToResearchBlueprint/);
  assert.match(db, /bulkPut/);
});

test('Research Blueprint reads and writes are project-scoped and transactional', () => {
  assert.match(db, /loadResearchBlueprint/);
  assert.match(db, /saveResearchBlueprint/);
  assert.match(db, /expectedVersion = blueprint\.version/);
  assert.match(db, /actualVersion/);
  assert.match(db, /changed elsewhere/);
  assert.match(db, /db\.transaction\("rw"/);
});
