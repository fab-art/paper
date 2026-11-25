export type ProtocolStatus = "draft" | "ready-for-owner-review" | "approved" | "amended";
export interface ResearchProtocolDraft {
  id: string;
  projectId: string;
  version: number;
  status: ProtocolStatus;
  researchQuestion: string;
  studyDesign: string;
  setting: string;
  population: string;
  sampleSize: string;
  outcomes: string[];
  analysisPlan: string;
  assumptions: string[];
  limitations: string[];
  createdAt: number;
  updatedAt: number;
}
export interface ProtocolReadiness {
  ready: boolean;
  completionPercent: number;
  completed: string[];
  missing: string[];
  requiresOwnerApproval: true;
}

export function createProtocolDraft(input: {
  projectId: string; id?: string; now?: number; researchQuestion?: string; studyDesign?: string;
  setting?: string; population?: string; sampleSize?: string; outcomes?: string[];
  analysisPlan?: string; assumptions?: string[]; limitations?: string[];
}): ResearchProtocolDraft {
  const outcomes = (input.outcomes ?? []).map(value => value.trim()).filter(Boolean);
  if ((input.outcomes ?? []).some(value => !value.trim())) throw new Error("Each protocol outcome must contain a description.");
  if (new Set(outcomes.map(value => value.toLocaleLowerCase())).size !== outcomes.length) throw new Error("Protocol outcomes must be unique.");
  const now = input.now ?? Date.now();
  return {
    id: input.id ?? "protocol:" + input.projectId, projectId: input.projectId, version: 1, status: "draft",
    researchQuestion: input.researchQuestion?.trim() ?? "", studyDesign: input.studyDesign?.trim() ?? "",
    setting: input.setting?.trim() ?? "", population: input.population?.trim() ?? "",
    sampleSize: input.sampleSize?.trim() ?? "", outcomes, analysisPlan: input.analysisPlan?.trim() ?? "",
    assumptions: [...(input.assumptions ?? [])], limitations: [...(input.limitations ?? [])],
    createdAt: now, updatedAt: now
  };
}

export function assessProtocolReadiness(protocol: ResearchProtocolDraft): ProtocolReadiness {
  const checks: Array<[string, boolean]> = [
    ["research question", Boolean(protocol.researchQuestion.trim())],
    ["study design", Boolean(protocol.studyDesign.trim())],
    ["setting", Boolean(protocol.setting.trim())],
    ["population", Boolean(protocol.population.trim())],
    ["valid sample size", Boolean(protocol.sampleSize.trim()) && Number.isFinite(Number(protocol.sampleSize)) && Number(protocol.sampleSize) > 0],
    ["outcomes", protocol.outcomes.length > 0 && protocol.outcomes.every(value => Boolean(value.trim()))],
    ["analysis plan", Boolean(protocol.analysisPlan.trim())]
  ];
  const completed = checks.filter(([, done]) => done).map(([label]) => label);
  const missing = checks.filter(([, done]) => !done).map(([label]) => label);
  return { ready: missing.length === 0, completionPercent: Math.round(completed.length / checks.length * 100), completed, missing, requiresOwnerApproval: true };
}
