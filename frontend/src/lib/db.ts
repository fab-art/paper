import Dexie, { type Table } from "dexie";
import { assertProjectWritable } from "./project-write-guard.mjs";
import { assertProjectRevision } from "./project-revision-guard.mjs";
import type { Project, ProjectNote, ProjectAttachment, ProjectSearchHistory } from "./types";

class StudioDB extends Dexie {
  projects!: Table<Project, string>;
  notes!: Table<ProjectNote, string>;
  attachments!: Table<ProjectAttachment, string>;
  searches!: Table<ProjectSearchHistory, string>;
  deletedProjects!: Table<{ id: string; deletedAt: number }, string>;
  constructor() {
    super("paperorchestra-studio");
    this.version(1).stores({ projects: "id, updatedAt, name" });
    this.version(2).stores({
      projects: "id, updatedAt, name, status",
      notes: "id, projectId, updatedAt, createdAt",
      attachments: "id, projectId, createdAt, name"
    });
    this.version(3).stores({
      projects: "id, updatedAt, name, status",
      notes: "id, projectId, updatedAt, createdAt",
      attachments: "id, projectId, createdAt, name",
      searches: "id, projectId, searchedAt"
    });
    this.version(4).stores({
      projects: "id, updatedAt, name, status",
      notes: "id, projectId, updatedAt, createdAt",
      attachments: "id, projectId, createdAt, name",
      searches: "id, projectId, searchedAt",
      deletedProjects: "id, deletedAt"
    });
  }
}
export const db = new StudioDB();

// Each browser tab keeps its own last-seen revision. IndexedDB transactions
// serialize writes across tabs; this token prevents a stale tab from winning
// after it acquires the write transaction.
const knownProjectRevisions = new Map<string, number>();

export async function saveProject(project: Project) {
  let savedRevision: number | undefined;
  await db.transaction("rw", db.projects, db.deletedProjects, async () => {
    if (await db.deletedProjects.get(project.id)) {
      throw new Error("This project was permanently deleted in another tab. Reload the Research Station before continuing.");
    }
    const existing = await db.projects.get(project.id);
    const expectedRevision = knownProjectRevisions.get(project.id) ?? project.revision ?? 0;
    const actualRevision = existing?.revision ?? 0;
    if (existing) {
      assertProjectRevision(expectedRevision, actualRevision);
    } else if (knownProjectRevisions.has(project.id) || (project.revision ?? 0) > 0) {
      throw new Error("This project no longer exists in the local research library. Reload the Research Station before continuing.");
    }

    const next: Project = { ...project, revision: actualRevision + 1 };
    // A stale tab must not silently unarchive a project after another tab archived it.
    if (existing?.archivedAt && !next.archivedAt) next.archivedAt = existing.archivedAt;
    next.updatedAt = Date.now();
    await db.projects.put(next);
    savedRevision = next.revision;
  });
  if (savedRevision !== undefined) knownProjectRevisions.set(project.id, savedRevision);
}

export async function restoreProject(project: Project) {
  let restoredRevision: number | undefined;
  await db.transaction("rw", db.projects, db.deletedProjects, async () => {
    if (await db.deletedProjects.get(project.id)) return;
    const existing = await db.projects.get(project.id);
    if (!existing) return;
    const expectedRevision = knownProjectRevisions.get(project.id) ?? project.revision ?? 0;
    const actualRevision = existing.revision ?? 0;
    assertProjectRevision(expectedRevision, actualRevision);
    const restored: Project = { ...existing, ...project, revision: actualRevision + 1, updatedAt: Date.now() };
    delete restored.archivedAt;
    await db.projects.put(restored);
    restoredRevision = restored.revision;
  });
  if (restoredRevision !== undefined) knownProjectRevisions.set(project.id, restoredRevision);
}

export async function loadProject(id: string) {
  const project = await db.projects.get(id);
  if (project) knownProjectRevisions.set(id, project.revision ?? 0);
  else knownProjectRevisions.delete(id);
  return project;
}

export async function listProjects() {
  const projects = await db.projects.orderBy("updatedAt").reverse().toArray();
  const liveIds = new Set(projects.map(project => project.id));
  for (const id of knownProjectRevisions.keys()) {
    if (!liveIds.has(id)) knownProjectRevisions.delete(id);
  }
  for (const project of projects) knownProjectRevisions.set(project.id, project.revision ?? 0);
  return projects;
}

export async function deleteProjectAndData(projectId: string, expectedRevision?: number) {
  await db.transaction("rw", db.projects, db.notes, db.attachments, db.searches, db.deletedProjects, async () => {
    const existing = await db.projects.get(projectId);
    if (expectedRevision !== undefined) {
      if (!existing) return;
      assertProjectRevision(expectedRevision, existing.revision ?? 0);
    }
    await db.deletedProjects.put({ id: projectId, deletedAt: Date.now() });
    await Promise.all([
      db.notes.where("projectId").equals(projectId).delete(),
      db.attachments.where("projectId").equals(projectId).delete(),
      db.searches.where("projectId").equals(projectId).delete(),
      db.projects.delete(projectId)
    ]);
  });
  knownProjectRevisions.delete(projectId);
}

export async function listProjectNotes(projectId: string) {
  return db.notes.where("projectId").equals(projectId).toArray().then(rows => rows.sort((a, b) => b.updatedAt - a.updatedAt));
}

export async function saveProjectNote(note: ProjectNote) {
  await db.transaction("rw", db.projects, db.deletedProjects, db.notes, async () => {
    await assertProjectWritable(note.projectId, {
      getDeletedProject: id => db.deletedProjects.get(id),
      getProject: id => db.projects.get(id)
    });
    await db.notes.put({ ...note, updatedAt: Date.now() });
  });
}

export async function deleteProjectNote(id: string) {
  await db.notes.delete(id);
}

export async function listProjectAttachments(projectId: string) {
  return db.attachments.where("projectId").equals(projectId).toArray().then(rows => rows.sort((a, b) => b.createdAt - a.createdAt));
}

export async function saveProjectAttachment(file: ProjectAttachment) {
  await db.transaction("rw", db.projects, db.deletedProjects, db.attachments, async () => {
    await assertProjectWritable(file.projectId, {
      getDeletedProject: id => db.deletedProjects.get(id),
      getProject: id => db.projects.get(id)
    });
    await db.attachments.put(file);
  });
}

export async function deleteProjectAttachment(id: string) {
  await db.attachments.delete(id);
}

export async function listProjectSearchHistory(projectId: string) {
  const entries = await db.searches.where("projectId").equals(projectId).toArray();
  return entries.sort((a, b) => b.searchedAt - a.searchedAt);
}

export async function recordProjectSearch(entry: ProjectSearchHistory) {
  await db.transaction("rw", db.projects, db.deletedProjects, db.searches, async () => {
    await assertProjectWritable(entry.projectId, {
      getDeletedProject: id => db.deletedProjects.get(id),
      getProject: id => db.projects.get(id)
    });
    await db.searches.put(entry);
    const history = await db.searches.where("projectId").equals(entry.projectId).toArray();
    const stale = history.sort((a, b) => b.searchedAt - a.searchedAt).slice(12);
    if (stale.length) await db.searches.bulkDelete(stale.map(item => item.id));
  });
}
