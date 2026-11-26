import test from "node:test";
import assert from "node:assert/strict";
import {
  createResearchBlueprint, updateResearchBlueprint, validateResearchBlueprint, approveResearchBlueprint,
  createProductionPlan, createProductionTask, addProductionTask,
  updateProductionTask, getProductionProgress, getTaskReadiness
} from "../src/domain/research-orchestration.mjs";

const project = {
  id: "p-1", name: "Diabetes care study", researchQuestion: "What improves diabetes control?",
  objectives: ["Assess glycaemic control"], methodology: "Mixed methods",
  status: "planning", papers: [], milestones: []
};

test("blueprint migration preserves legacy project content and does not mutate the project", () => {
  const blueprint = createResearchBlueprint(project, { now: 1000 });
  assert.equal(blueprint.projectId, "p-1");
  assert.equal(blueprint.title, project.name);
  assert.equal(blueprint.researchQuestion, project.researchQuestion);
  assert.deepEqual(blueprint.objectives, project.objectives);
  assert.equal(blueprint.methodology, project.methodology);
  assert.equal(blueprint.approvalStatus, "draft");
  assert.equal(blueprint.updatedAt, 1000);
  assert.equal(project.researchBlueprint, undefined);
});

test("blueprint validation identifies missing question, objectives and methods", () => {
  const blueprint = createResearchBlueprint({ id: "p-2", name: "Empty study" }, { now: 1 });
  const issues = validateResearchBlueprint(blueprint);
  assert.ok(issues.some(issue => issue.code === "question-required"));
  assert.ok(issues.some(issue => issue.code === "objective-required"));
  assert.ok(issues.some(issue => issue.code === "methodology-required"));
});

test("researcher approval is blocked until required blueprint sections are complete", () => {
  const incomplete = createResearchBlueprint({ id: "p-3", name: "Incomplete" }, { now: 1 });
  assert.throws(() => approveResearchBlueprint(incomplete, { now: 2 }), /complete/i);
});

test("blueprint approval records the researcher decision and version", () => {
  const complete = {
    ...createResearchBlueprint(project, { now: 1 }),
    researchQuestion: "What improves diabetes control?",
    objectives: ["Assess control"], methodology: "Prospective cohort",
    inclusionCriteria: "Adults with type 2 diabetes",
    exclusionCriteria: "Pregnancy",
    analysisPlan: "Descriptive and regression analysis"
  };
  const approved = approveResearchBlueprint(complete, { now: 2000, approvedBy: "researcher-1" });
  assert.equal(approved.approvalStatus, "approved");
  assert.equal(approved.approvedAt, 2000);
  assert.equal(approved.approvedBy, "researcher-1");
  assert.equal(approved.version, complete.version + 1);
  assert.equal(complete.approvalStatus, "draft");
});

test("default production plan creates a connected, researcher-controlled research workflow", () => {
  const plan = createProductionPlan(project, { now: 1000 });
  assert.ok(plan.tasks.length >= 5);
  assert.ok(plan.tasks.every(task => task.requiresApproval === true));
  assert.ok(plan.tasks.some(task => task.stage === "literature"));
  assert.ok(plan.tasks.some(task => task.stage === "evidence"));
  assert.ok(plan.tasks.some(task => task.stage === "analysis"));
  assert.ok(plan.tasks.some(task => task.stage === "writing"));
  assert.equal(plan.tasks[0].status, "planned");
});

test("custom tasks reject duplicate identifiers, missing dependencies and self-dependencies", () => {
  const plan = createProductionPlan(project, { now: 1 });
  const task = createProductionTask({ id: "custom-1", title: "Ethics submission", stage: "blueprint", now: 2 });
  const withTask = addProductionTask(plan, task);
  assert.throws(() => addProductionTask(withTask, task), /already exists/i);
  assert.throws(() => addProductionTask(plan, { ...task, id: "custom-2", dependsOn: ["missing"] }), /dependency/i);
  assert.throws(() => createProductionTask({ id: "bad", title: "Bad", stage: "blueprint", dependsOn: ["bad"] }), /itself/i);
});

test("task readiness blocks work until every dependency is completed", () => {
  const plan = createProductionPlan(project, { now: 1 });
  const downstream = plan.tasks.find(task => task.dependsOn.length > 0);
  const readiness = getTaskReadiness(plan, downstream.id);
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.blockedBy, downstream.dependsOn);
});

test("task status cannot advance while dependencies are incomplete", () => {
  const plan = createProductionPlan(project, { now: 1 });
  const downstream = plan.tasks.find(task => task.dependsOn.length > 0);
  assert.throws(() => updateProductionTask(plan, downstream.id, { status: "in-progress" }, { now: 2 }), /incomplete dependenc/i);
});

test("task updates are immutable and completion requires an explicit researcher confirmation", () => {
  const plan = createProductionPlan(project, { now: 1 });
  const first = plan.tasks[0];
  const started = updateProductionTask(plan, first.id, { status: "in-progress" }, { now: 2 });
  const completed = updateProductionTask(started, first.id, { status: "completed", completionConfirmedBy: "researcher-1" }, { now: 3, blueprintApproved: true });
  assert.equal(completed.tasks[0].status, "completed");
  assert.equal(completed.tasks[0].completionConfirmedBy, "researcher-1");
  assert.equal(plan.tasks[0].status, "planned");
});

test("production progress reports completed, blocked and remaining tasks", () => {
  const plan = createProductionPlan(project, { now: 1 });
  const first = plan.tasks[0];
  const started = updateProductionTask(plan, first.id, { status: "in-progress" }, { now: 2 });
  const completed = updateProductionTask(started, first.id, { status: "completed", completionConfirmedBy: "researcher-1" }, { now: 3, blueprintApproved: true });
  const progress = getProductionProgress(completed);
  assert.equal(progress.total, completed.tasks.length);
  assert.equal(progress.completed, 1);
  assert.ok(progress.percent > 0);
  assert.ok(progress.remaining >= 1);
});

test("editing an approved blueprint invalidates its approval and requires a fresh review", () => {
  const approved = {
    ...createResearchBlueprint(project, { now: 1 }),
    researchQuestion: "What improves diabetes control?", objectives: ["Assess control"],
    methodology: "Prospective cohort", inclusionCriteria: "Adults", exclusionCriteria: "Children",
    analysisPlan: "Regression", approvalStatus: "approved", approvedAt: 10, approvedBy: "researcher-1"
  };
  const edited = updateResearchBlueprint(approved, { researchQuestion: "What improves outcomes in diabetes care?" }, { now: 20 });
  assert.equal(edited.approvalStatus, "draft");
  assert.equal(edited.approvedAt, null);
  assert.equal(edited.approvedBy, null);
  assert.equal(edited.updatedAt, 20);
  assert.equal(approved.approvalStatus, "approved");
});

test("production cannot complete its blueprint gate until the blueprint is approved", () => {
  const plan = createProductionPlan(project, { now: 1 });
  const first = plan.tasks[0];
  const started = updateProductionTask(plan, first.id, { status: "in-progress" }, { now: 2 });
  assert.throws(
    () => updateProductionTask(started, first.id, { status: "completed", completionConfirmedBy: "researcher-1" }, { now: 3 }),
    /approval.*blueprint/i
  );
  const approved = updateProductionTask(started, first.id, { status: "completed", completionConfirmedBy: "researcher-1" }, { now: 3, blueprintApproved: true });
  assert.equal(approved.tasks[0].status, "completed");
});

test("downstream tasks become blocked again when blueprint approval is withdrawn", () => {
  const plan = createProductionPlan(project, { now: 1 });
  const first = plan.tasks[0];
  const second = plan.tasks[1];
  const started = updateProductionTask(plan, first.id, { status: "in-progress" }, { now: 2 });
  const approved = updateProductionTask(started, first.id, { status: "completed", completionConfirmedBy: "researcher-1" }, { now: 3, blueprintApproved: true });
  assert.equal(getTaskReadiness(approved, second.id, { blueprintApproved: true }).ready, true);
  const withdrawn = getTaskReadiness(approved, second.id, { blueprintApproved: false });
  assert.equal(withdrawn.ready, false);
  assert.ok(withdrawn.blockedBy.includes("research-blueprint-approval"));
});
