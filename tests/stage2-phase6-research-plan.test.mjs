import test from "node:test";
import assert from "node:assert/strict";
import {
  createResearchStationPlan,
  updateResearchPlanTask,
  addResearchPlanTask,
  addResearchPlanMilestone,
  updateResearchPlanMilestone
} from "../frontend/src/lib/research-intake.ts";

test("empirical blueprint creates an editable route with research design and analysis work", () => {
  const plan = createResearchStationPlan("empirical-study", "idea", 1000);
  assert.equal(plan.paperType, "empirical-study");
  assert.ok(plan.stations.some(station => station.stationId === "protocol"));
  assert.ok(plan.stations.some(station => station.stationId === "data"));
  assert.ok(plan.stations.flatMap(station => station.tasks).some(task => /study design/i.test(task.title)));
  assert.ok(plan.milestones.length >= 3);
});

test("review blueprint includes screening and evidence synthesis tasks", () => {
  const plan = createResearchStationPlan("systematic-review", "review", 1000);
  const titles = plan.stations.flatMap(station => station.tasks).map(task => task.title.toLowerCase());
  assert.ok(titles.some(title => title.includes("screen")));
  assert.ok(titles.some(title => title.includes("synthes")));
});

test("dataset-first blueprint starts with data profiling and keeps a non-linear route", () => {
  const plan = createResearchStationPlan("dataset-analysis", "dataset", 1000);
  assert.equal(plan.stations[0].stationId, "data");
  assert.ok(plan.stations.some(station => station.stationId === "protocol"));
});

test("researcher edits task title and description without losing completion or other tasks", () => {
  const plan = createResearchStationPlan("empirical-study", "idea", 1000);
  const task = plan.stations[0].tasks[0];
  const updated = updateResearchPlanTask(plan, task.id, { title: "My revised task", description: "Researcher-defined scope" }, 2000);
  assert.equal(updated.stations[0].tasks[0].title, "My revised task");
  assert.equal(updated.stations[0].tasks[0].description, "Researcher-defined scope");
  assert.equal(updated.updatedAt, 2000);
  assert.equal(updated.stations[0].tasks.length, plan.stations[0].tasks.length);
});

test("researcher can add a custom task and a dated milestone", () => {
  const plan = createResearchStationPlan("case-report", "idea", 1000);
  const withTask = addResearchPlanTask(plan, "writing", "Confirm case timeline", "Check dates against the clinical record.", 2000, "custom-task");
  const withMilestone = addResearchPlanMilestone(withTask, "Complete first draft", "2027-01-15", 3000, "milestone-custom");
  assert.ok(withMilestone.stations.find(station => station.stationId === "writing")?.tasks.some(task => task.id === "custom-task"));
  assert.deepEqual(withMilestone.milestones.at(-1), { id: "milestone-custom", title: "Complete first draft", dueDate: "2027-01-15", completed: false });
});

test("milestone updates preserve the date unless the researcher changes it", () => {
  const plan = createResearchStationPlan("conference-paper", "idea", 1000);
  const milestone = plan.milestones[0];
  const updated = updateResearchPlanMilestone(plan, milestone.id, { completed: true }, 2000);
  assert.equal(updated.milestones[0].completed, true);
  assert.equal(updated.milestones[0].dueDate, milestone.dueDate);
});

test("plan editors reject blank task and milestone titles", () => {
  const plan = createResearchStationPlan("other", "idea", 1000);
  assert.throws(() => updateResearchPlanTask(plan, plan.stations[0].tasks[0].id, { title: "   " }), /title/i);
  assert.throws(() => addResearchPlanMilestone(plan, "   "), /title/i);
});

test("researcher can reorder stations without losing their tasks", async () => {
  const { moveResearchPlanStation } = await import("../frontend/src/lib/research-intake.ts");
  const plan = createResearchStationPlan("empirical-study", "idea", 1000);
  const firstTaskId = plan.stations[0].tasks[0].id;
  const moved = moveResearchPlanStation(plan, 0, 1, 2000);
  assert.equal(moved.stations[1].stationId, plan.stations[0].stationId);
  assert.equal(moved.stations[1].tasks[0].id, firstTaskId);
  assert.throws(() => moveResearchPlanStation(plan, 0, -1), /position/i);
});
