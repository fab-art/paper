import { listProjects, saveProject, deleteProjectAndData, restoreProject } from "../../../../frontend/src/lib/db";
import type { Project } from "../../../../frontend/src/lib/types";

/**
 * Read-only bridge to the existing local project store.
 * Do not add writes here: mutations belong to explicit feature services and
 * must preserve the legacy revision/tombstone guards.
 */
export async function listLocalProjects(): Promise<Project[]> {
  return listProjects();
}


/** Explicit owner-facing mutations retain the legacy revision and tombstone guards. */
export async function createLocalProject(project: Project): Promise<Project | undefined> {
  return saveProject(project);
}

export async function updateLocalProject(project: Project): Promise<Project | undefined> {
  return saveProject(project);
}

export async function archiveLocalProject(project: Project): Promise<Project | undefined> {
  return saveProject({ ...project, archivedAt: Date.now() });
}

export async function restoreLocalProject(project: Project): Promise<Project | undefined> {
  return restoreProject(project);
}

export async function permanentlyDeleteLocalProject(project: Project): Promise<void> {
  await deleteProjectAndData(project.id, project.revision ?? 0);
}

export {
  loadResearchBlueprint,
  saveResearchBlueprint,
  listProjectNotes,
  saveProjectNote,
  deleteProjectNote,
  listProjectAttachments,
  saveProjectAttachment,
  deleteProjectAttachment
} from "../../../../frontend/src/lib/db";
