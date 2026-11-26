import test from "node:test";
import assert from "node:assert/strict";
import {
  protocolEntityId,
  protocolEntityToDraft,
  protocolDraftToEntity
} from "../src/features/blueprint/blueprintProtocolModel.mjs";

test("uses a stable project-scoped identity for the protocol entity", () => {
  assert.equal(protocolEntityId("project-7"), "protocol:project-7");
});

test("round-trips a protocol draft through a researcher-owned research entity", () => {
  const draft = {
    id: "protocol:project-7",
    projectId: "project-7",
    version: 2,
    status: "ready-for-owner-review",
    researchQuestion: "What predicts treatment response?",
    studyDesign: "Retrospective cohort",
    setting: "Rwanda",
    population: "Adults with type 2 diabetes",
    sampleSize: "250",
    outcomes: ["HbA1c change"],
    analysisPlan: "Multivariable regression",
    assumptions: ["Complete follow-up"],
    limitations: ["Single-centre data"],
    createdAt: 100,
    updatedAt: 200
  };
  const entity = protocolDraftToEntity(draft, undefined, 300);
  assert.equal(entity.id, "protocol:project-7");
  assert.equal(entity.projectId, "project-7");
  assert.equal(entity.entityType, "research-protocol");
  assert.equal(entity.status, "proposed");
  assert.equal(entity.provenance.kind, "owner");
  assert.deepEqual(protocolEntityToDraft(entity), draft);
});

test("keeps existing protocol creation time and increments the entity version", () => {
  const existing = {
    id: "protocol:project-7",
    projectId: "project-7",
    entityType: "research-protocol",
    version: 4,
    status: "draft",
    title: "Research protocol",
    payload: {},
    provenance: { kind: "owner", recordedAt: 100 },
    createdAt: 100,
    updatedAt: 200
  };
  const entity = protocolDraftToEntity({
    projectId: "project-7",
    status: "draft",
    researchQuestion: "Question",
    studyDesign: "",
    setting: "",
    population: "",
    sampleSize: "",
    outcomes: [],
    analysisPlan: "",
    assumptions: [],
    limitations: []
  }, existing, 400);
  assert.equal(entity.version, 5);
  assert.equal(entity.createdAt, 100);
  assert.equal(entity.updatedAt, 400);
});

test("ignores entities that are not project research protocols", () => {
  assert.equal(protocolEntityToDraft({ entityType: "methodology", payload: {} }), null);
});
