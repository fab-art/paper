import type { Project } from "../../../../frontend/src/lib/types";
import type { ResearchBlueprint, ProductionLine, ProductionTask } from "../../../../frontend/src/lib/research-blueprint";

export function createResearchBlueprint(project: Project, options?: { now?: number }): ResearchBlueprint;
export function updateResearchBlueprint(blueprint: ResearchBlueprint, patch: Partial<ResearchBlueprint>, options?: { now?: number }): ResearchBlueprint;
export function validateResearchBlueprint(blueprint: ResearchBlueprint): Array<{ code: string; message: string }>;
export function approveResearchBlueprint(blueprint: ResearchBlueprint, options: { now?: number; approvedBy: string }): ResearchBlueprint;
export function createProductionTask(input: { id?: string; title: string; description?: string; stage: ProductionTask["stage"]; dependsOn?: string[]; dueDate?: string; requiresApproval?: boolean; now?: number }): ProductionTask;
export function createProductionPlan(project: Project, options?: { now?: number }): ProductionLine;
export function getTaskReadiness(plan: ProductionLine, taskId: string, options?: { blueprintApproved?: boolean }): { ready: boolean; blockedBy: string[] };
export function addProductionTask(plan: ProductionLine, task: ProductionTask, options?: { now?: number }): ProductionLine;
export function updateProductionTask(plan: ProductionLine, taskId: string, patch: Partial<ProductionTask>, options?: { now?: number; blueprintApproved?: boolean }): ProductionLine;
export function getProductionProgress(plan: ProductionLine, options?: { blueprintApproved?: boolean }): { total: number; completed: number; blocked: number; remaining: number; percent: number };
