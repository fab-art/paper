import Dexie, { type Table } from "dexie";
import { assertProjectWritable } from "./project-write-guard.mjs";
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

export async function saveProject(project: Project) {
  await db.transaction("rw", db.projects, db.deletedProjects, async () => {
    if (await db.deletedProjects.get(project.id)) {
      throw new Error("This project was permanently deleted in another tab. Reload the Research Station before continuing.");
    }
    const existing = await db.projects.get(project.id);
    const next = { ...project };
    // A stale tab must not silently unarchive a project after another tab archived it.
    if (existing?.archivedAt && !next.archivedAt) next.archivedAt = existing.archivedAt;
    next.updatedAt = Date.now();
    await db.projects.put(next);
  });
}
export async function restoreProject(project: Project) {
  await db.transaction("rw", db.projects, db.deletedProjects, async () => {
    if (await db.deletedProjects.get(project.id)) return;
    const existing = await db.projects.get(project.id);
    if (!existing) return;
    const restored = { ...existing, ...project, updatedAt: Date.now() };
    delete restored.archivedAt;
    await db.projects.put(restored);
  });
}
export async function loadProject(id: string) { return db.projects.get(id); }
export async function listProjects() { return db.projects.orderBy("updatedAt").reverse().toArray(); }
export async function deleteProjectAndData(projectId: string) {
  await db.transaction("rw", db.projects, db.notes, db.attachments, db.searches, db.deletedProjects, async () => {
    await db.deletedProjects.put({ id: projectId, deletedAt: Date.now() });
    await Promise.all([
      db.notes.where("projectId").equals(projectId).delete(),
      db.attachments.where("projectId").equals(projectId).delete(),
      db.searches.where("projectId").equals(projectId).delete(),
      db.projects.delete(projectId)
    ]);
  });
}
export async function listProjectNotes(projectId: string) {
  return db.notes.where("projectId").equals(projectId).toArray().then(rows => rows.sort((a,b)=>b.updatedAt-a.updatedAt));
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
export async function deleteProjectNote(id: string) { await db.notes.delete(id); }
export async function listProjectAttachments(projectId: string) {
  return db.attachments.where("projectId").equals(projectId).toArray().then(rows => rows.sort((a,b)=>b.createdAt-a.createdAt));
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
export async function deleteProjectAttachment(id: string) { await db.attachments.delete(id); }
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
