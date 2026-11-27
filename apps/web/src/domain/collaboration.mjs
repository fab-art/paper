const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createSharedProjectPayload(project) {
  if (!project?.id) throw new Error("A local project is required before sharing.");
  const {
    logs, agentRecords, templateFiles, figures, revision, archivedAt,
    cloudProjectId, cloudRevision, ...research
  } = project;
  return {
    schemaVersion: 1,
    project: JSON.parse(JSON.stringify(research))
  };
}

export function canEditSharedProject(role) {
  return role === "owner" || role === "editor";
}

export function canManageProjectMembers(role) {
  return role === "owner";
}

export function validateMemberAssignment(userId, role) {
  const normalized = String(userId ?? "").trim();
  if (!UUID.test(normalized)) throw new Error("Enter a valid account ID (UUID) for an existing PaperOrchestra user.");
  if (role !== "editor" && role !== "viewer") throw new Error("The owner role cannot be assigned to another account.");
  return { userId: normalized, role };
}

export function mergeSharedProjectPayload(localProject, remotePayload, { cloudProjectId, cloudRevision } = {}) {
  if (!localProject?.id) throw new Error("A local project is required before applying a cloud version.");
  if (remotePayload?.schemaVersion !== 1 || !remotePayload.project || typeof remotePayload.project !== "object") {
    throw new Error("The cloud project payload has an unsupported format.");
  }
  if (remotePayload.project.id !== localProject.id) {
    throw new Error("The cloud payload belongs to a different local project.");
  }
  return {
    ...localProject,
    ...remotePayload.project,
    id: localProject.id,
    revision: localProject.revision,
    cloudProjectId: cloudProjectId ?? localProject.cloudProjectId,
    cloudRevision: cloudRevision ?? localProject.cloudRevision
  };
}

export function normalizeProjectComment({ projectId, authorId, body }) {
  const text = String(body ?? "").trim();
  if (!String(projectId ?? "").trim() || !String(authorId ?? "").trim()) throw new Error("Project and author are required for a comment.");
  if (!text) throw new Error("A comment cannot be empty.");
  if (text.length > 10000) throw new Error("Comments must be 10000 characters or fewer.");
  return { project_id: projectId, author_id: authorId, body: text, resource_type: "project" };
}

export async function refreshSelectedSharedProject(rows, selectedId, handlers) {
  const nextId = rows.some(item => item.id === selectedId)
    ? selectedId
    : rows[0]?.id ?? "";

  if (nextId !== selectedId) {
    handlers.clearDetails();
    handlers.setSelectedId(nextId);
  } else if (nextId) {
    await handlers.refreshDetails(nextId);
  } else {
    handlers.clearDetails();
  }
  return nextId;
}
