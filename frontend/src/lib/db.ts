import Dexie, { type Table } from "dexie";
import { assertProjectWritable } from "./project-write-guard.mjs";
import { assertProjectRevision } from "./project-revision-guard.mjs";
import type { Project, ProjectNote, ProjectAttachment, ProjectSearchHistory } from "./types";
import {
  legacyProjectToResearchEntities,
  projectToResearchBlueprint,
  type ResearchBlueprint,
  type ResearchDecision,
  type ResearchEntity,
  type ResearchRelation
} from "./research-blueprint";

class StudioDB extends Dexie {
  projects!: Table<Project, string>;
  notes!: Table<ProjectNote, string>;
  attachments!: Table<ProjectAttachment, string>;
  searches!: Table<ProjectSearchHistory, string>;
  deletedProjects!: Table<{ id: string; deletedAt: number }, string>;
  researchBlueprints!: Table<ResearchBlueprint, string>;
  researchEntities!: Table<ResearchEntity, string>;
  researchRelations!: Table<ResearchRelation, string>;
  researchDecisions!: Table<ResearchDecision, string>;

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
    this.version(5).stores({
      projects: "id, updatedAt, name, status",
      notes: "id, projectId, updatedAt, createdAt",
      attachments: "id, projectId, createdAt, name",
      searches: "id, projectId, searchedAt",
      deletedProjects: "id, deletedAt",
      researchBlueprints: "id, projectId, updatedAt, lifecycleState, paperType",
      researchEntities: "id, projectId, entityType, updatedAt, status",
      researchRelations: "id, projectId, fromEntityId, toEntityId, relationType",
      researchDecisions: "id, projectId, subjectType, subjectId, createdAt, approvedByOwner"
    }).upgrade(async transaction => {
      const projects = await transaction.table("projects").toArray() as Project[];
      const now = Date.now();
      const blueprints = projects.map(project => projectToResearchBlueprint(project, now));
      const entities = projects.flatMap(project => legacyProjectToResearchEntities(project, now));
      if (blueprints.length) await transaction.table("researchBlueprints").bulkPut(blueprints);
      if (entities.length) await transaction.table("researchEntities").bulkPut(entities);
    });
  }
}
export const db = new StudioDB();

export async function saveProject(project: Project) {
  // Capture the caller's snapshot revision before awaiting IndexedDB. Reading a
  // mutable per-tab revision after the transaction is queued can let an older
  // debounce callback adopt a newer revision and overwrite newer content.
  const expectedRevision = project.revision ?? 0;
  let savedProject: Project | undefined;

  await db.transaction("rw", db.projects, db.deletedProjects, db.researchBlueprints, db.researchEntities, async () => {
    if (await db.deletedProjects.get(project.id)) {
      throw new Error("This project was permanently deleted in another tab. Reload the Research Station before continuing.");
    }
    const existing = await db.projects.get(project.id);
    const actualRevision = existing?.revision ?? 0;
    if (existing) {
      assertProjectRevision(expectedRevision, actualRevision);
    } else if (expectedRevision > 0) {
      throw new Error("This project no longer exists in the local research library. Reload the Research Station before continuing.");
    }

    const next: Project = { ...project, revision: actualRevision + 1 };
    if (existing?.archivedAt && !next.archivedAt) next.archivedAt = existing.archivedAt;
    next.updatedAt = Date.now();
    await db.projects.put(next);
    // New projects and any legacy project missing a canonical record receive a
    // one-time mapping. Existing Research Blueprint work is never overwritten
    // by a later save from the legacy Project editor.
    if (!(await db.researchBlueprints.get(project.id))) {
      await db.researchBlueprints.put(projectToResearchBlueprint(next));
      const migratedEntities = legacyProjectToResearchEntities(next);
      if (migratedEntities.length) await db.researchEntities.bulkPut(migratedEntities);
    }
    savedProject = next;
  });

  return savedProject;
}

export async function restoreProject(project: Project) {
  // As with saveProject, the expected revision belongs to this exact snapshot.
  const expectedRevision = project.revision ?? 0;
  let restoredProject: Project | undefined;

  await db.transaction("rw", db.projects, db.deletedProjects, async () => {
    if (await db.deletedProjects.get(project.id)) return;
    const existing = await db.projects.get(project.id);
    if (!existing) return;
    const actualRevision = existing.revision ?? 0;
    assertProjectRevision(expectedRevision, actualRevision);
    const restored: Project = { ...existing, ...project, revision: actualRevision + 1, updatedAt: Date.now() };
    delete restored.archivedAt;
    await db.projects.put(restored);
    restoredProject = restored;
  });

  return restoredProject;
}

export async function loadProject(id: string) {
  return db.projects.get(id);
}

export async function listProjects() {
  return db.projects.orderBy("updatedAt").reverse().toArray();
}

export async function loadResearchBlueprint(projectId: string) {
  const existing = await db.researchBlueprints.get(projectId);
  if (existing) return existing;
  const project = await db.projects.get(projectId);
  if (!project || await db.deletedProjects.get(projectId)) return undefined;

  const blueprint = projectToResearchBlueprint(project);
  const entities = legacyProjectToResearchEntities(project);
  await db.transaction("rw", db.projects, db.deletedProjects, db.researchBlueprints, db.researchEntities, async () => {
    const [current, latestProject, deleted] = await Promise.all([
      db.researchBlueprints.get(projectId),
      db.projects.get(projectId),
      db.deletedProjects.get(projectId)
    ]);
    if (!current && latestProject && !deleted) {
      await db.researchBlueprints.put(blueprint);
      if (entities.length) await db.researchEntities.bulkPut(entities);
    }
  });
  if (await db.deletedProjects.get(projectId)) return undefined;
  return db.researchBlueprints.get(projectId);
}

export async function saveResearchBlueprint(blueprint: ResearchBlueprint, expectedVersion = blueprint.version) {
  let saved: ResearchBlueprint | undefined;
  await db.transaction("rw", db.projects, db.deletedProjects, db.researchBlueprints, async () => {
    await assertProjectWritable(blueprint.projectId, {
      getDeletedProject: id => db.deletedProjects.get(id),
      getProject: id => db.projects.get(id)
    });
    const existing = await db.researchBlueprints.get(blueprint.projectId);
    const actualVersion = existing?.version ?? 0;
    if (expectedVersion !== actualVersion) {
      throw new Error("This Research Blueprint changed elsewhere. Reload it before saving to avoid overwriting newer research decisions.");
    }
    const next: ResearchBlueprint = {
      ...blueprint,
      id: blueprint.projectId,
      version: actualVersion + 1,
      updatedAt: Date.now()
    };
    await db.researchBlueprints.put(next);
    saved = next;
  });
  return saved;
}

export async function listResearchEntities(projectId: string) {
  return db.researchEntities.where("projectId").equals(projectId).toArray();
}

export async function listResearchRelations(projectId: string) {
  return db.researchRelations.where("projectId").equals(projectId).toArray();
}

export async function listResearchDecisions(projectId: string) {
  return db.researchDecisions.where("projectId").equals(projectId).toArray()
    .then(rows => rows.sort((a, b) => b.createdAt - a.createdAt));
}

export async function deleteProjectAndData(projectId: string, expectedRevision?: number) {
  await db.transaction(
    "rw",
    [
      db.projects,
      db.notes,
      db.attachments,
      db.searches,
      db.deletedProjects,
      db.researchBlueprints,
      db.researchEntities,
      db.researchRelations,
      db.researchDecisions
    ],
    async () => {
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
        db.researchEntities.where("projectId").equals(projectId).delete(),
        db.researchRelations.where("projectId").equals(projectId).delete(),
        db.researchDecisions.where("projectId").equals(projectId).delete(),
        db.researchBlueprints.delete(projectId),
        db.projects.delete(projectId)
      ]);
    }
  );
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
