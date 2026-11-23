import Dexie, { type Table } from "dexie";
import type { Project, ProjectNote, ProjectAttachment } from "./types";

class StudioDB extends Dexie {
  projects!: Table<Project, string>;
  notes!: Table<ProjectNote, string>;
  attachments!: Table<ProjectAttachment, string>;
  constructor() {
    super("paperorchestra-studio");
    this.version(1).stores({ projects: "id, updatedAt, name" });
    this.version(2).stores({
      projects: "id, updatedAt, name, status",
      notes: "id, projectId, updatedAt, createdAt",
      attachments: "id, projectId, createdAt, name"
    });
  }
}
export const db = new StudioDB();

export async function saveProject(project: Project) {
  project.updatedAt = Date.now();
  await db.projects.put(project);
}
export async function loadProject(id: string) { return db.projects.get(id); }
export async function listProjects() { return db.projects.orderBy("updatedAt").reverse().toArray(); }
export async function listProjectNotes(projectId: string) {
  return db.notes.where("projectId").equals(projectId).reverse().sortBy("updatedAt");
}
export async function saveProjectNote(note: ProjectNote) { note.updatedAt = Date.now(); await db.notes.put(note); }
export async function deleteProjectNote(id: string) { await db.notes.delete(id); }
export async function listProjectAttachments(projectId: string) {
  return db.attachments.where("projectId").equals(projectId).reverse().sortBy("createdAt");
}
export async function saveProjectAttachment(file: ProjectAttachment) { await db.attachments.put(file); }
export async function deleteProjectAttachment(id: string) { await db.attachments.delete(id); }
