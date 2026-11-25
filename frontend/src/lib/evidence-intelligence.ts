import type { ResearchEntity, ResearchProvenance } from "./research-blueprint";

export type EvidenceJudgement = "supports" | "partially-supports" | "contradicts" | "irrelevant";
export type ClaimEvidenceStatus = "awaiting-verification" | "supported" | "partially-supported" | "unsupported" | "conflicting-evidence";

export interface ClaimEvidenceAssessment {
  status: ClaimEvidenceStatus;
  supportingCount: number;
  partialCount: number;
  contradictingCount: number;
  irrelevantCount: number;
  assessedAt: number;
}

export function normalizeEvidenceText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

export function createClaimRecord(input: { id: string; projectId: string; text: string; now?: number }): ResearchEntity {
  const text = input.text.trim();
  if (!text) throw new Error("A claim must contain text.");
  const now = input.now ?? Date.now();
  return {
    id: input.id, projectId: input.projectId, entityType: "claim", version: 1,
    status: "draft", title: text.slice(0, 160),
    payload: { text, evidenceStatus: "awaiting-verification", evidenceCount: 0 },
    provenance: { kind: "owner", sourceId: input.projectId, sourceLabel: "Researcher-authored claim", recordedAt: now },
    createdAt: now, updatedAt: now
  };
}

export function createEvidencePassage(input: {
  id: string; projectId: string; sourceEntityId: string; quote: string; locator?: string; now?: number;
}): ResearchEntity {
  const quote = input.quote.trim();
  if (!quote) throw new Error("An evidence passage must preserve a non-empty source quotation.");
  if (!input.sourceEntityId.trim()) throw new Error("An evidence passage must link to a source record.");
  const now = input.now ?? Date.now();
  return {
    id: input.id, projectId: input.projectId, entityType: "research-note", version: 1,
    status: "draft", title: quote.slice(0, 120),
    payload: { recordType: "evidence-passage", quote, locator: input.locator?.trim() || "", sourceEntityId: input.sourceEntityId },
    provenance: { kind: "owner", sourceId: input.sourceEntityId, sourceLabel: "Researcher-transcribed source passage", recordedAt: now },
    createdAt: now, updatedAt: now
  };
}

export function assessClaimEvidence(
  claim: ResearchEntity,
  judgements: Array<{ id: string; judgement: EvidenceJudgement }>,
  now = Date.now()
): ClaimEvidenceAssessment {
  if (claim.entityType !== "claim") throw new Error("Evidence can only be assessed against a claim.");
  const counts = {
    supportingCount: judgements.filter(item => item.judgement === "supports").length,
    partialCount: judgements.filter(item => item.judgement === "partially-supports").length,
    contradictingCount: judgements.filter(item => item.judgement === "contradicts").length,
    irrelevantCount: judgements.filter(item => item.judgement === "irrelevant").length
  };
  const status: ClaimEvidenceStatus = counts.contradictingCount && counts.supportingCount + counts.partialCount
    ? "conflicting-evidence"
    : counts.contradictingCount ? "conflicting-evidence"
    : counts.supportingCount ? "supported"
    : counts.partialCount ? "partially-supported"
    : judgements.length ? "unsupported" : "awaiting-verification";
  return { status, ...counts, assessedAt: now };
}

export function claimEvidencePayload(assessment: ClaimEvidenceAssessment) {
  return { evidenceStatus: assessment.status, evidenceCount: assessment.supportingCount + assessment.partialCount + assessment.contradictingCount + assessment.irrelevantCount, assessment };
}
