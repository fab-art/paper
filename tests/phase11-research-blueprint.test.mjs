import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { projectToResearchBlueprint, legacyProjectToResearchEntities } from '../frontend/src/lib/research-blueprint.ts';

const types = readFileSync('frontend/src/lib/research-blueprint.ts', 'utf8');
const db = readFileSync('frontend/src/lib/db.ts', 'utf8');
const projectTypes = readFileSync('frontend/src/lib/types.ts', 'utf8');

function legacyProject(overrides = {}) {
  return {
    id: 'project-legacy-1',
    name: 'Diabetes outcomes in Rwanda',
    notes: 'A local-first project',
    latex: '',
    bibtex: '',
    template: 'default',
    outline: [
      { id: 'intro', title: 'Introduction', description: 'Background', children: [
        { id: 'gap', title: 'Knowledge gap', description: 'What is unknown' }
      ] }
    ],
    papers: [
      { title: 'Diabetes outcomes', authors: ['A. Author'], doi: '10.1000/example', year: 2024 }
    ],
    figures: [],
    logs: '',
    agentRecords: [],
    updatedAt: 1700000000000,
    revision: 4,
    researchQuestion: 'What factors influence diabetes outcomes?',
    objectives: ['Estimate prevalence', 'Identify associated factors'],
    methodology: 'Cross-sectional study',
    status: 'active',
    ...overrides
  };
}

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

test('legacy Project records map to a canonical blueprint without losing project identity', () => {
  const project = legacyProject();
  const blueprint = projectToResearchBlueprint(project, 1800000000000);
  assert.equal(blueprint.id, project.id);
  assert.equal(blueprint.projectId, project.id);
  assert.equal(blueprint.title, project.name);
  assert.equal(blueprint.researchQuestion, project.researchQuestion);
  assert.deepEqual(blueprint.objectives, project.objectives);
  assert.equal(blueprint.lifecycleState, 'in-progress');
  assert.equal(blueprint.legacyProjectRevision, 4);
  assert.equal(blueprint.provenance.kind, 'legacy-migration');
});

test('legacy project mapping preserves question, objectives, methods, sources and nested outline entities', () => {
  const entities = legacyProjectToResearchEntities(legacyProject(), 1800000000000);
  assert.deepEqual(entities.map(entity => entity.entityType), [
    'research-question',
    'objective',
    'objective',
    'methodology',
    'source',
    'outline-section',
    'outline-section'
  ]);
  assert.ok(entities.every(entity => entity.projectId === 'project-legacy-1'));
  assert.ok(entities.every(entity => entity.provenance.kind === 'legacy-migration'));
  assert.equal(entities.find(entity => entity.entityType === 'source').payload.doi, '10.1000/example');
});

test('legacy migration identifiers are deterministic across repeated mapping', () => {
  const project = legacyProject();
  const first = legacyProjectToResearchEntities(project, 1800000000000);
  const second = legacyProjectToResearchEntities(project, 1800000000000);
  assert.deepEqual(first.map(entity => entity.id), second.map(entity => entity.id));
});

test('systematic review data is retained and correctly classifies a scoping review', () => {
  const project = legacyProject({
    systematicReview: {
      protocol: { reviewType: 'scoping' },
      screening: {},
      extraction: {},
      riskOfBias: {}
    }
  });
  const blueprint = projectToResearchBlueprint(project, 1800000000000);
  const entities = legacyProjectToResearchEntities(project, 1800000000000);
  assert.equal(blueprint.paperType, 'scoping-review');
  assert.ok(entities.some(entity => entity.entityType === 'systematic-review'));
});

test('Dexie schema adds Research Blueprint stores without removing legacy stores', () => {
  assert.match(db, /this\.version\(5\)/);
  assert.match(db, /researchBlueprints/);
  assert.match(db, /researchEntities/);
  assert.match(db, /researchRelations/);
  assert.match(db, /researchDecisions/);
  for (const legacyStore of ['projects', 'notes', 'attachments', 'searches', 'deletedProjects']) {
    assert.ok(db.includes(legacyStore), `legacy store missing: ${legacyStore}`);
  }
  assert.match(projectTypes, /export interface Project/);
});

test('database upgrade backfills existing projects using deterministic legacy mappings', () => {
  assert.match(db, /\.upgrade\(/);
  assert.match(db, /projectToResearchBlueprint/);
  assert.match(db, /legacyProjectToResearchEntities/);
  assert.match(db, /bulkPut/);
});

test('Research Blueprint reads and writes are project-scoped and concurrency guarded', () => {
  assert.match(db, /loadResearchBlueprint/);
  assert.match(db, /saveResearchBlueprint/);
  assert.match(db, /if \(!\(await db\.researchBlueprints\.get\(project\.id\)\)\)/);
  assert.match(db, /projectToResearchBlueprint\(next\)/);
  assert.match(db, /expectedVersion = blueprint\.version/);
  assert.match(db, /actualVersion/);
  assert.match(db, /changed elsewhere/);
  assert.match(db, /db\.transaction\("rw"/);
});
