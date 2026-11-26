export const WORKSPACES = Object.freeze([
  { id: "station", label: "Research Station", group: "Workspace", path: "/", status: "active" },
  { id: "projects", label: "Projects", group: "Workspace", path: "/projects", status: "active" },
  { id: "blueprint", label: "Research Blueprint", group: "Plan & orchestrate", path: "/blueprint", status: "active" },
  { id: "production", label: "Production Line", group: "Plan & orchestrate", path: "/production", status: "active" },
  { id: "orchestration", label: "Intelligent Orchestration", group: "Plan & orchestrate", path: "/orchestration", status: "active" },
  { id: "literature", label: "Literature Discovery", group: "Evidence", path: "/literature", status: "active" },
  { id: "evidence", label: "Evidence Workspace", group: "Evidence", path: "/evidence", status: "active" },
  { id: "writing", label: "Writing Studio", group: "Create & analyze", path: "/writing", status: "active" },
  { id: "data", label: "Data & Methods", group: "Create & analyze", path: "/data", status: "active" },
  { id: "systematic-review", label: "Systematic Reviews", group: "Create & analyze", path: "/systematic-reviews", status: "active" },
  { id: "quality", label: "Scientific Audit", group: "Publish", path: "/quality", status: "active" },
  { id: "publication", label: "Publication", group: "Publish", path: "/publication", status: "active" },
  { id: "collaboration", label: "Collaboration", group: "Manage", path: "/collaboration", status: "planned" },
  { id: "settings", label: "Settings", group: "Manage", path: "/settings", status: "planned" }
]);

export function getWorkspaceByPath(pathname) {
  return WORKSPACES.find((workspace) => workspace.path === pathname);
}

export function getWorkspaceGroups() {
  return WORKSPACES.reduce((groups, workspace) => {
    (groups[workspace.group] ??= []).push(workspace);
    return groups;
  }, {});
}
