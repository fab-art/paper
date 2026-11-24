import Dexie, { type Table } from "dexie";
import type { Project, ProjectNote, ProjectAttachment, ProjectSearchHistory } from "./types";

class StudioDB extends Dexie {
  projects!: Table<Project, string>;
  notes!: Table<ProjectNote, string>;
  attachments!: Table<ProjectAttachment, string>;
  searches!: Table<ProjectSearchHistory, string>;
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
  }
}
export const db = new StudioDB();

export async function saveProject(project: Project) {
  await db.transaction("rw", db.projects, async () => {
    const existing = await db.projects.get(project.id);
    const next = { ...project };
    // A stale tab must not silently unarchive a project after another tab archived it.
    if (existing?.archivedAt && !next.archivedAt) next.archivedAt = existing.archivedAt;
    next.updatedAt = Date.now();
    await db.projects.put(next);
  });
}
export async function restoreProject(project: Project) {
  await db.transaction("rw", db.projects, async () => {
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
  await db.transaction("rw", db.projects, db.notes, db.attachments, db.searches, async () => {
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
export async function saveProjectNote(note: ProjectNote) { note.updatedAt = Date.now(); await db.notes.put(note); }
export async function deleteProjectNote(id: string) { await db.notes.delete(id); }
export async function listProjectAttachments(projectId: string) {
  return db.attachments.where("projectId").equals(projectId).toArray().then(rows => rows.sort((a,b)=>b.createdAt-a.createdAt));
}
export async function saveProjectAttachment(file: ProjectAttachment) { await db.attachments.put(file); }
export async function deleteProjectAttachment(id: string) { await db.attachments.delete(id); }
export async function listProjectSearchHistory(projectId: string) {
  const entries = await db.searches.where("projectId").equals(projectId).toArray();
  return entries.sort((a, b) => b.searchedAt - a.searchedAt);
}
export async function recordProjectSearch(entry: ProjectSearchHistory) {
  await db.searches.put(entry);
  const history = await listProjectSearchHistory(entry.projectId);
  const stale = history.slice(12);
  if (stale.length) await db.searches.bulkDelete(stale.map(item => item.id));
}
