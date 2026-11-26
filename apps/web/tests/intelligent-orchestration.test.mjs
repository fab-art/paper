import test from "node:test";
import assert from "node:assert/strict";
import {
  getWorkspaceForResearchStage, createResearchTaskBrief, buildResearchAgentPrompt,
  createResearchAgentProposal, decideResearchAgentProposal, applyApprovedResearchProposal
} from "../src/domain/intelligent-orchestration.mjs";

const project = { id: "p-1", name: "Diabetes study", revision: 4, researchQuestion: "What improves diabetes control?" };
const task = { id: "t-1", title: "Curate literature", description: "Find and curate relevant studies.", stage: "literature", status: "in-progress", dependsOn: ["t-0"], version: 2, updatedAt: 20 };
const plan = { tasks: [{ id: "t-0", status: "completed" }, task] };
const blueprint = { approvalStatus: "approved", version: 3, researchQuestion: project.researchQuestion };
const contextSources = [{ id: "paper-1", kind: "paper", label: "Trial publication", version: 1 }];

test("maps each research stage to its existing workspace", () => {
  assert.equal(getWorkspaceForResearchStage("literature"), "/literature");
  assert.equal(getWorkspaceForResearchStage("analysis"), "/data");
  assert.equal(getWorkspaceForResearchStage("verification"), "/evidence");
  assert.equal(getWorkspaceForResearchStage("publication"), "/writing");
  assert.equal(getWorkspaceForResearchStage("unknown"), null);
});

test("prepares a task brief only for a started, dependency-ready task with approved blueprint", () => {
  const brief = createResearchTaskBrief({ project, task, plan, blueprint, contextSources, now: 50 });
  assert.equal(brief.projectRevision, 4);
  assert.equal(brief.taskVersion, 2);
  assert.equal(brief.workspacePath, "/literature");
  assert.equal(brief.contextSources[0].id, "paper-1");
  assert.equal(brief.contextSources[0].excerpt, "");
  assert.equal(brief.contextSources[0].sourceLocator, null);
  assert.ok(brief.guardrails.some(rule => rule.includes("Do not invent")));
  assert.throws(() => createResearchTaskBrief({ project, task: { ...task, status: "planned" }, plan, blueprint }), /Start the task/i);
  assert.throws(() => createResearchTaskBrief({ project, task, plan, blueprint: { approvalStatus: "draft" } }), /blocked/i);
});

test("task brief refuses unfinished dependencies", () => {
  assert.throws(() => createResearchTaskBrief({
    project, task, plan: { tasks: [{ id: "t-0", status: "in-progress" }, task] }, blueprint, contextSources
  }), /blocked/i);
});

test("agent prompt keeps the system guardrails separate from project data", () => {
  const brief = createResearchTaskBrief({ project, task, plan, blueprint, contextSources });
  const prompt = buildResearchAgentPrompt(brief);
  assert.match(prompt.system, /Do not make scientific judgments/);
  assert.match(prompt.user, /paper-1/);
  assert.doesNotMatch(prompt.system, /Diabetes study/);
});

test("proposal rejects malformed output and unregistered evidence references", () => {
  const brief = createResearchTaskBrief({ project, task, plan, blueprint, contextSources });
  assert.throws(() => createResearchAgentProposal({ brief, output: { summary: "A summary", steps: [], deliverables: [] } }), /actionable steps/i);
  assert.throws(() => createResearchAgentProposal({
    brief, output: { summary: "A summary", steps: ["Review"], evidenceRefs: ["invented"], deliverables: [{ title: "Matrix", content: "Draft", evidenceRefs: [] }] }
  }), /unknown evidence/i);
});

test("proposal is created as unapproved and records provenance", () => {
  const brief = createResearchTaskBrief({ project, task, plan, blueprint, contextSources, now: 50 });
  const proposal = createResearchAgentProposal({
    brief, now: 60, id: "proposal-1",
    output: { summary: "Prepare a study matrix.", steps: ["Review eligible records"], evidenceRefs: ["paper-1"], deliverables: [{ title: "Study matrix", content: "Draft matrix", evidenceRefs: ["paper-1"] }], limitations: ["Metadata requires verification."] }
  });
  assert.equal(proposal.status, "proposed");
  assert.equal(proposal.blueprintVersion, 3);
  assert.equal(proposal.projectRevision, 4);
  assert.equal(proposal.approvedBy, null);
  assert.equal(proposal.auditTrail[0].event, "proposed");
});

test("only a named researcher can approve or reject a proposal", () => {
  const brief = createResearchTaskBrief({ project, task, plan, blueprint, contextSources });
  const proposal = createResearchAgentProposal({
    brief, output: { summary: "Prepare a matrix.", steps: ["Review"], deliverables: [{ title: "Matrix", content: "Draft" }] }
  });
  assert.throws(() => decideResearchAgentProposal(proposal, "approve", { actor: "" }), /identity/i);
  const approved = decideResearchAgentProposal(proposal, "approve", { actor: "researcher-1", now: 70 });
  assert.equal(approved.status, "approved");
  assert.equal(approved.approvedBy, "researcher-1");
  assert.equal(approved.auditTrail.at(-1).event, "approved");
  const rejected = decideResearchAgentProposal(proposal, "reject", { actor: "researcher-2", now: 80 });
  assert.equal(rejected.status, "rejected");
});

test("approved deliverables can be applied once without completing the production task", () => {
  const brief = createResearchTaskBrief({ project, task, plan, blueprint, contextSources });
  const proposed = createResearchAgentProposal({
    brief, id: "proposal-apply",
    output: { summary: "Prepare a matrix.", steps: ["Review"], evidenceRefs: ["paper-1"], deliverables: [{ title: "Matrix", content: "Draft", evidenceRefs: ["paper-1"] }] }
  });
  const approved = decideResearchAgentProposal(proposed, "approve", { actor: "researcher-1", now: 70 });
  const result = applyApprovedResearchProposal(task, approved, { expectedTaskVersion: 2, expectedBlueprintVersion: 3, blueprintApproved: true, actor: "researcher-1", now: 90 });
  assert.equal(result.task.version, 3);
  assert.equal(result.task.proposedDeliverables.length, 1);
  assert.equal(result.task.status, "in-progress");
  assert.equal(result.proposal.status, "applied");
  assert.equal(result.proposal.auditTrail.at(-1).event, "applied");
  assert.throws(() => applyApprovedResearchProposal(result.task, approved, { expectedTaskVersion: 2, actor: "researcher-1" }), /changed|already been applied/i);
});

test("proposal cannot be applied to a different task", () => {
  const brief = createResearchTaskBrief({ project, task, plan, blueprint, contextSources });
  const proposed = createResearchAgentProposal({
    brief, output: { summary: "Prepare a matrix.", steps: ["Review"], deliverables: [{ title: "Matrix", content: "Draft" }] }
  });
  const approved = decideResearchAgentProposal(proposed, "approve", { actor: "researcher-1" });
  assert.throws(() => applyApprovedResearchProposal({ ...task, id: "other" }, approved, { expectedTaskVersion: 2, actor: "researcher-1" }), /different task/i);
});


test("proposal application is blocked when blueprint approval or version becomes stale", () => {
  const brief = createResearchTaskBrief({ project, task, plan, blueprint, contextSources });
  const proposed = createResearchAgentProposal({
    brief,
    output: { summary: "Prepare a matrix.", steps: ["Review"], deliverables: [{ title: "Matrix", content: "Draft" }] }
  });
  const approved = decideResearchAgentProposal(proposed, "approve", { actor: "researcher-1" });
  assert.throws(() => applyApprovedResearchProposal(task, approved, {
    expectedTaskVersion: 2, expectedBlueprintVersion: 3, blueprintApproved: false, actor: "researcher-1"
  }), /approval was withdrawn/i);
  assert.throws(() => applyApprovedResearchProposal(task, approved, {
    expectedTaskVersion: 2, expectedBlueprintVersion: 4, blueprintApproved: true, actor: "researcher-1"
  }), /blueprint changed/i);
});
