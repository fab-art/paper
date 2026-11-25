import {
  deleteProjectAndData,
  db,
  listProjectAttachments,
  listProjectNotes,
  listProjects as listStoredProjects,
  loadProject,
  restoreProject,
  saveProject
} from "../../../../../frontend/src/lib/db";
import { assertProjectWritable } from "../../../../../frontend/src/lib/project-write-guard.mjs";
import type {
  Paper,
  Project,
  ProjectAttachment,
  ProjectNote
} from "../../../../../frontend/src/lib/types";
import {
  createProjectRecord,
  isDuplicatePaper,
  isArchivedProject
} from "./projectModel.mjs";
import type { ProjectIntakeInput } from "./projectModel.mjs";

function assertSavedProject(project: Project | undefined): Project {
  if (!project) throw new Error("The project could not be saved to the local research library.");
  return project;
}

function projectWriteDependencies() {
  return {
    getDeletedProject: (id: string) => db.deletedProjects.get(id),
    getProject: (id: string) => db.projects.get(id)
  };
}

export async function listProjects(): Promise<Project[]> {
  return listStoredProjects();
}

export async function getProject(projectId: string): Promise<Project | null> {
  return (await loadProject(projectId)) ?? null;
}

export async function createProject(input: ProjectIntakeInput): Promise<Project> {
  const record = createProjectRecord(input, { id: crypto.randomUUID() });
  return assertSavedProject(await saveProject(record));
}

export async function saveProjectSnapshot(project: Project): Promise<Project> {
  return assertSavedProject(await saveProject(project));
}

export async function archiveProject(project: Project): Promise<Project> {
  if (isArchivedProject(project)) return project;
  return saveProjectSnapshot({ ...project, archivedAt: Date.now() });
}

export async function restoreArchivedProject(project: Project): Promise<Project> {
  const restored = await restoreProject(project);
  if (!restored) throw new Error("The project could not be restored because it no longer exists.");
  return restored;
}

export async function permanentlyDeleteProject(project: Project): Promise<void> {
  if (!(await loadProject(project.id))) {
    throw new Error("The project no longer exists in the local research library.");
  }
  await deleteProjectAndData(project.id, project.revision ?? 0);
}

export async function listNotes(projectId: string): Promise<ProjectNote[]> {
  return listProjectNotes(projectId);
}

export async function saveNote(note: ProjectNote): Promise<ProjectNote> {
  const updatedAt = Date.now();
  const saved = { ...note, updatedAt };
  await db.transaction("rw", [db.projects, db.deletedProjects, db.notes], async () => {
    await assertProjectWritable(note.projectId, projectWriteDependencies());
    const existing = await db.notes.get(note.id);
    if (existing && existing.projectId !== note.projectId) {
      throw new Error("This note belongs to another project and cannot be moved by editing it.");
    }
    await db.notes.put(saved);
  });
  return saved;
}

export async function deleteNote(projectId: string, noteId: string): Promise<boolean> {
  return db.transaction("rw", [db.projects, db.deletedProjects, db.notes], async () => {
    await assertProjectWritable(projectId, projectWriteDependencies());
    const note = await db.notes.get(noteId);
    if (!note) return false;
    if (note.projectId !== projectId) {
      throw new Error("This note does not belong to the current project.");
    }
    await db.notes.delete(noteId);
    return true;
  });
}

export async function listAttachments(projectId: string): Promise<ProjectAttachment[]> {
  return listProjectAttachments(projectId);
}

export async function saveAttachment(attachment: ProjectAttachment): Promise<ProjectAttachment> {
  if (attachment.size > 30 * 1024 * 1024) {
    throw new Error("Attachments must be 30 MB or smaller.");
  }
  if (attachment.blob.size !== attachment.size) {
    throw new Error("The attachment size does not match its stored file.");
  }
  await db.transaction("rw", [db.projects, db.deletedProjects, db.attachments], async () => {
    await assertProjectWritable(attachment.projectId, projectWriteDependencies());
    const existing = await db.attachments.get(attachment.id);
    if (existing && existing.projectId !== attachment.projectId) {
      throw new Error("This file belongs to another project and cannot be moved by editing it.");
    }
    await db.attachments.put(attachment);
  });
  return attachment;
}

export async function deleteAttachment(projectId: string, attachmentId: string): Promise<boolean> {
  return db.transaction("rw", [db.projects, db.deletedProjects, db.attachments], async () => {
    await assertProjectWritable(projectId, projectWriteDependencies());
    const attachment = await db.attachments.get(attachmentId);
    if (!attachment) return false;
    if (attachment.projectId !== projectId) {
      throw new Error("This file does not belong to the current project.");
    }
    await db.attachments.delete(attachmentId);
    return true;
  });
}

export async function addPaper(project: Project, paper: Paper): Promise<{ project: Project; added: boolean }> {
  if (isDuplicatePaper(project.papers ?? [], paper)) {
    return { project, added: false };
  }
  const updated = { ...project, papers: [...(project.papers ?? []), paper] };
  return { project: await saveProjectSnapshot(updated), added: true };
}
