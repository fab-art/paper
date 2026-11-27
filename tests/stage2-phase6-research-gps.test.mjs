import test from "node:test";
import assert from "node:assert/strict";
import { getResearchEntryPlan, getResearchNextAction } from "../frontend/src/lib/research-intake.ts";

test("Research GPS exposes all five supported project entry paths", () => {
  const paths = ["idea", "literature", "dataset", "review", "manuscript"];
  for (const path of paths) {
    const plan = getResearchEntryPlan(path);
    assert.equal(plan.id, path);
    assert.ok(plan.firstAction.length > 0);
    assert.ok(plan.recommendedPaperTypes.length > 0);
  }
});

test("dataset-first projects route to profiling before statistical recommendations", () => {
  const plan = getResearchEntryPlan("dataset", "empirical-study");
  assert.match(plan.firstAction, /profile/i);
  assert.ok(plan.route[0] === "data" || plan.route.includes("data"));
});

test("review-first entry recommends a review blueprint and screening protocol", () => {
  const plan = getResearchEntryPlan("review");
  assert.ok(plan.recommendedPaperTypes.includes("systematic-review"));
  assert.match(plan.firstAction, /review|protocol/i);
});

test("next action uses missing project work rather than an arbitrary progress percentage", () => {
  const next = getResearchNextAction({
    researchQuestion: "",
    paperType: "empirical-study",
    papers: [],
    methodology: "",
    researchMode: "guided"
  });
  assert.equal(next.id, "research-question");
  assert.ok(next.title.length > 0);
});

test("next action advances to source discovery after the brief is present", () => {
  const next = getResearchNextAction({
    researchQuestion: "What is the research question?",
    paperType: "empirical-study",
    papers: [],
    methodology: "",
    researchMode: "guided"
  });
  assert.equal(next.id, "source-discovery");
});

test("idea-first starts with question refinement while dataset and review routes start in their own stations", () => {
  assert.equal(getResearchNextAction({ startPath: "idea", paperType: "empirical-study", researchQuestion: "" }).id, "research-question");
  assert.equal(getResearchNextAction({ startPath: "dataset", paperType: "dataset-analysis", researchQuestion: "" }).id, "dataset-profile");
  assert.equal(getResearchNextAction({ startPath: "review", paperType: "systematic-review", researchQuestion: "" }).id, "review-protocol");
  assert.equal(getResearchNextAction({ startPath: "manuscript", paperType: "existing-manuscript", researchQuestion: "" }).id, "manuscript-inventory");
  assert.equal(getResearchNextAction({ startPath: "literature", researchQuestion: "" }).id, "source-discovery");
});
