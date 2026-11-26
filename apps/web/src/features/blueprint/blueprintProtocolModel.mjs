const PROTOCOL_ENTITY_PREFIX = "protocol:";

const VALID_PROTOCOL_STATUSES = new Set([
  "draft",
  "ready-for-owner-review",
  "approved",
  "amended"
]);

export function protocolEntityId(projectId) {
  return PROTOCOL_ENTITY_PREFIX + String(projectId);
}

export function protocolDraftToEntity(draft, existing, now = Date.now()) {
  if (!draft?.projectId) throw new Error("A project is required to save a research protocol.");
  const status = VALID_PROTOCOL_STATUSES.has(draft.status) ? draft.status : "draft";
  const payload = {
    version: Number.isInteger(draft.version) && draft.version > 0 ? draft.version : 1,
    status,
    researchQuestion: String(draft.researchQuestion ?? "").trim(),
    studyDesign: String(draft.studyDesign ?? "").trim(),
    setting: String(draft.setting ?? "").trim(),
    population: String(draft.population ?? "").trim(),
    sampleSize: String(draft.sampleSize ?? "").trim(),
    outcomes: Array.isArray(draft.outcomes) ? draft.outcomes.map(value => String(value).trim()).filter(Boolean) : [],
    analysisPlan: String(draft.analysisPlan ?? "").trim(),
    assumptions: Array.isArray(draft.assumptions) ? draft.assumptions.map(String) : [],
    limitations: Array.isArray(draft.limitations) ? draft.limitations.map(String) : []
  };
  return {
    id: protocolEntityId(draft.projectId),
    projectId: draft.projectId,
    entityType: "research-protocol",
    version: (existing?.version ?? 0) + 1,
    status: status === "approved" ? "approved" : status === "ready-for-owner-review" ? "proposed" : "draft",
    title: "Research protocol",
    payload,
    provenance: existing?.provenance?.kind === "owner"
      ? { ...existing.provenance, recordedAt: now }
      : { kind: "owner", sourceId: draft.projectId, sourceLabel: "Researcher-authored protocol", recordedAt: now },
    createdAt: existing?.createdAt ?? draft.createdAt ?? now,
    updatedAt: now
  };
}

export function protocolEntityToDraft(entity) {
  if (!entity || entity.entityType !== "research-protocol" || !entity.payload) return null;
  const payload = entity.payload;
  const status = VALID_PROTOCOL_STATUSES.has(payload.status) ? payload.status : "draft";
  return {
    id: entity.id,
    projectId: entity.projectId,
    version: Number.isInteger(payload.version) && payload.version > 0 ? payload.version : 1,
    status,
    researchQuestion: String(payload.researchQuestion ?? ""),
    studyDesign: String(payload.studyDesign ?? ""),
    setting: String(payload.setting ?? ""),
    population: String(payload.population ?? ""),
    sampleSize: String(payload.sampleSize ?? ""),
    outcomes: Array.isArray(payload.outcomes) ? payload.outcomes.map(String) : [],
    analysisPlan: String(payload.analysisPlan ?? ""),
    assumptions: Array.isArray(payload.assumptions) ? payload.assumptions.map(String) : [],
    limitations: Array.isArray(payload.limitations) ? payload.limitations.map(String) : [],
    createdAt: entity.createdAt,
    updatedAt: Number.isFinite(payload.updatedAt) ? payload.updatedAt : entity.updatedAt
  };
}
