import type { Project } from "../../../../frontend/src/lib/types";
export interface SharedProjectPayload { schemaVersion: 1; project: Partial<Project> & { id: string } }
export function createSharedProjectPayload(project: Project): SharedProjectPayload;
export function canEditSharedProject(role: string | null | undefined): boolean;
export function canManageProjectMembers(role: string | null | undefined): boolean;
export function validateMemberAssignment(userId: string, role: "editor" | "viewer"): { userId: string; role: "editor" | "viewer" };
export function mergeSharedProjectPayload(localProject: Project, remotePayload: unknown, options?: { cloudProjectId?: string; cloudRevision?: number }): Project;
export function normalizeProjectComment(input: { projectId: string; authorId: string; body: string }): { project_id: string; author_id: string; body: string; resource_type: "project" };
export function refreshSelectedSharedProject(
  rows: Array<{ id: string }>,
  selectedId: string,
  handlers: {
    refreshDetails: (projectId: string) => Promise<void>;
    setSelectedId: (projectId: string) => void;
    clearDetails: () => void;
  }
): Promise<string>;
