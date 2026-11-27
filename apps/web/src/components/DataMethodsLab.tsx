import type { Project, ProjectAttachment } from "../../../../frontend/src/lib/types";
import LegacyDataMethodsLab from "../../../../frontend/src/components/DataMethodsLab";

export default function DataMethodsLab({ attachments, project }: { attachments: ProjectAttachment[]; project: Project }) {
  return <LegacyDataMethodsLab attachments={attachments} project={project} />;
}
