import type { ResearchEntity } from "./research-blueprint";

export interface GroundedPassage { id: string; quote: string; sourceEntityId: string; locator: string; judgement: "supports" | "partially-supports" | "contradicts" | "irrelevant" | "unassessed"; }
export interface GroundedWritingContext { passages: GroundedPassage[]; verifiedResults: Array<{ id: string; title: string; summary: string }>; promptContext: string; }

/** Select only source-linked passages and owner-approved/verified analysis outputs. */
export function buildGroundedWritingContext(entities: ResearchEntity[]): GroundedWritingContext {
  const passages = entities.flatMap(entity => {
    if (entity.entityType !== "research-note" || entity.payload.recordType !== "evidence-passage") return [];
    const quote = typeof entity.payload.quote === "string" ? entity.payload.quote.trim() : "";
    const sourceEntityId = typeof entity.payload.sourceEntityId === "string" ? entity.payload.sourceEntityId.trim() : "";
    if (!quote || !sourceEntityId) return [];
    const raw = entity.payload.judgement;
    const judgement: GroundedPassage["judgement"] = raw === "supports" || raw === "partially-supports" || raw === "contradicts" || raw === "irrelevant" ? raw : "unassessed";
    return [{ id: entity.id, quote, sourceEntityId, locator: typeof entity.payload.locator === "string" ? entity.payload.locator : "", judgement }];
  });
  const verifiedResults = entities.flatMap(entity => {
    if (entity.entityType !== "analysis" || (entity.status !== "approved" && entity.status !== "verified")) return [];
    const summary = typeof entity.payload.summary === "string" ? entity.payload.summary.trim() : "";
    return summary ? [{ id: entity.id, title: entity.title, summary }] : [];
  });
  const promptContext = ["SOURCE PASSAGES (exact researcher-transcribed quotations; preserve IDs and locators):",
    ...passages.map(item => "[" + item.id + "] source=" + item.sourceEntityId + "; locator=" + (item.locator || "not recorded") + "; assessment=" + item.judgement + "; quote=" + JSON.stringify(item.quote)),
    "VERIFIED ANALYSIS OUTPUTS (do not alter values):",
    ...verifiedResults.map(item => "[" + item.id + "] " + item.title + ": " + item.summary),
    "Do not cite metadata as if it were a read passage. Never invent citations, findings, values or missing evidence."].join("\n");
  return { passages, verifiedResults, promptContext };
}

export function assessDraftClaimSupport(claims: Array<{ text: string; evidenceEntityIds: string[] }>, availableEvidenceIds: string[]) {
  const available = new Set(availableEvidenceIds);
  return claims.map(claim => {
    const linked = claim.evidenceEntityIds.filter(id => available.has(id));
    return { text: claim.text, evidenceEntityIds: linked, status: linked.length ? "evidence-linked" as const : "awaiting-verification" as const };
  });
}