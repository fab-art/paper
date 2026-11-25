import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createResearchTask, getReadyResearchTasks, getResearchRoute,
  RESEARCH_AGENTS, RESEARCH_STATIONS, summarizeResearchStations,
  transitionResearchTask
} from '../frontend/src/lib/research-production-line.ts';
import { buildResearchIntake, PAPER_TYPE_BLUEPRINTS } from '../frontend/src/lib/research-intake.ts';

const now = 1800000000000;
const task = (overrides = {}) => createResearchTask({
  id: 'task-1', projectId: 'project-1', stationId: 'intake',
  title: 'Confirm research question', now, ...overrides
});

test('research line defines ordered stations and routes appropriate to paper type', () => {
  assert.equal(RESEARCH_STATIONS[0].id, 'intake');
  assert.equal(RESEARCH_STATIONS.at(-1).id, 'revision');
  assert.ok(getResearchRoute('empirical-study').some(station => station.id === 'data'));
  assert.ok(!getResearchRoute('systematic-review').some(station => station.id === 'data'));
  assert.ok(getResearchRoute('systematic-review').some(station => station.id === 'evidence'));
});

test('task creation is queued by default and deduplicates dependency and input references', () => {
  const created = task({ dependencyTaskIds: ['a', 'a', 'b'], inputEntityIds: ['x', 'x'] });
  assert.equal(created.status, 'queued');
  assert.deepEqual(created.dependencyTaskIds, ['a', 'b']);
  assert.deepEqual(created.inputEntityIds, ['x']);
  assert.equal(created.version, 1);
});

test('a task requiring approval before execution waits for the owner', () => {
  const created = task({ ownerApprovalBeforeRun: true });
  assert.equal(created.status, 'awaiting-owner');
  assert.equal(created.approvalStage, 'before-run');
  const approved = transitionResearchTask(created, 'approve', 'owner', [created], now + 1, true, 'Protocol reviewed');
  assert.equal(approved.task.status, 'queued');
  assert.equal(approved.task.ownerApproved, true);
  assert.equal(approved.approval?.decidedByOwner, true);
});

test('tasks cannot start until every dependency is complete', () => {
  const dependency = task({ id: 'dependency' });
  const blocked = task({ id: 'dependent', dependencyTaskIds: ['dependency'] });
  assert.deepEqual(getReadyResearchTasks([dependency, blocked]), []);
  assert.throws(() => transitionResearchTask(blocked, 'start', 'owner', [dependency, blocked], now), /dependencies/);
  const completedDependency = { ...dependency, status: 'completed' as const };
  assert.deepEqual(getReadyResearchTasks([completedDependency, blocked]).map(item => item.id), ['dependent']);
});

test('paused agents receive no ready work', () => {
  const queued = task();
  assert.deepEqual(getReadyResearchTasks([queued], true), []);
});

test('agent output requiring review cannot be completed without owner approval', () => {
  const queued = task({ assignedAgentId: 'research-planner', ownerApprovalRequired: true });
  const running = transitionResearchTask(queued, 'start', 'agent', [queued], now + 1).task;
  const submitted = transitionResearchTask(running, 'submit', 'agent', [running], now + 2).task;
  assert.equal(submitted.status, 'awaiting-owner');
  assert.equal(submitted.approvalStage, 'after-run');
  assert.throws(() => transitionResearchTask(submitted, 'approve', 'agent', [submitted], now + 3, true), /owner confirmation/);
  const approved = transitionResearchTask(submitted, 'approve', 'owner', [submitted], now + 4, true, 'Reviewed output');
  assert.equal(approved.task.status, 'completed');
  assert.equal(approved.approval?.decision, 'approved');
});

test('agent cannot start unassigned work or approve a scientific decision', () => {
  const queued = task();
  assert.throws(() => transitionResearchTask(queued, 'start', 'agent', [queued], now), /no assigned/);
  assert.throws(() => transitionResearchTask(queued, 'approve', 'agent', [queued], now, true), /owner confirmation/);
});

test('task transitions reject invalid state changes and support owner retry', () => {
  const queued = task();
  assert.throws(() => transitionResearchTask(queued, 'submit', 'owner', [queued], now), /running task/);
  const failed = { ...queued, status: 'failed' as const };
  const retried = transitionResearchTask(failed, 'retry', 'owner', [failed], now + 1).task;
  assert.equal(retried.status, 'queued');
});

test('station summaries reflect actual task state without inventing completion', () => {
  const queued = task();
  const summary = summarizeResearchStations([queued], 'empirical-study');
  assert.equal(summary[0].status, 'queued');
  assert.equal(summary[0].taskCount, 1);
  assert.equal(summary[1].status, 'not-started');
});

test('agent registry assigns bounded roles and forbids agent approval', () => {
  assert.ok(RESEARCH_AGENTS.length >= 10);
  assert.ok(RESEARCH_AGENTS.every(agent => agent.canApprove === false));
  assert.ok(RESEARCH_AGENTS.every(agent => agent.prohibited.length > 0));
});

test('guided intake creates a draft research story arc without claiming owner approval', () => {
  const brief = buildResearchIntake({
    title: 'Diabetes care outcomes',
    problemOrObservation: 'Follow-up is inconsistent.',
    researchQuestion: 'What affects continuity of care?',
    intendedAudience: 'Clinicians and health planners',
    availableMaterials: ['PDFs', 'CSV', 'PDFs'],
    paperType: 'empirical-study'
  });
  assert.equal(brief.title, 'Diabetes care outcomes');
  assert.equal(brief.researchQuestion, 'What affects continuity of care?');
  assert.deepEqual(brief.availableMaterials, ['PDFs', 'CSV']);
  assert.equal(brief.ownerConfirmationRequired, true);
  assert.ok(brief.storyArc.some(item => item.includes('Knowledge gap')));
  assert.equal(PAPER_TYPE_BLUEPRINTS.length, 10);
});
