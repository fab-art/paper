import type { ResearchProtocolDraft } from "../../../../../frontend/src/lib/research-protocol";
import type { ResearchEntity } from "../../../../../frontend/src/lib/research-blueprint";

export function protocolEntityId(projectId: string): string;
export function protocolDraftToEntity(
  draft: ResearchProtocolDraft,
  existing?: ResearchEntity,
  now?: number
): ResearchEntity;
export function protocolEntityToDraft(entity?: ResearchEntity | null): ResearchProtocolDraft | null;
