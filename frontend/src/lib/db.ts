import Dexie, { type Table } from "dexie";
import type { Project } from "./types";

class StudioDB extends Dexie {
  projects!: Table<Project, string>;
  constructor() {
    super("paperorchestra-studio");
    this.version(1).stores({ projects: "id, updatedAt, name" });
  }
}
export const db = new StudioDB();

export async function saveProject(project: Project) {
  project.updatedAt = Date.now();
  await db.projects.put(project);
}
export async function loadProject(id: string) { return db.projects.get(id); }
export async function listProjects() { return db.projects.orderBy("updatedAt").reverse().toArray(); }
