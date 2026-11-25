export interface Workspace {
  id: string;
  label: string;
  group: string;
  path: string;
  status: "active" | "planned";
}
export const WORKSPACES: readonly Workspace[];
export function getWorkspaceByPath(pathname: string): Workspace | undefined;
export function getWorkspaceGroups(): Record<string, Workspace[]>;
