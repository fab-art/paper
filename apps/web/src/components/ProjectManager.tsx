import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Archive, ArrowLeft, Download, FilePlus2, FolderKanban, Plus, RotateCcw, Save, Trash2, UploadCloud, X } from "lucide-react";
import { Button, Card } from "@santi020k/lumen-react";
import type { Project, ProjectAttachment, ProjectNote, ResearchMilestone } from "../../../../frontend/src/lib/types";
import {
  archiveLocalProject, createLocalProject, deleteProjectAttachment, deleteProjectNote,
  listLocalProjects, listProjectAttachments, listProjectNotes, permanentlyDeleteLocalProject,
  restoreLocalProject, saveProjectAttachment, saveProjectNote, updateLocalProject
} from "../adapters/legacy-projects";
import {
  createProjectDraft, filterProjects, getProjectCollection, projectRoute, toggleMilestone,
  validateProjectDraft
} from "../domain/project-management.mjs";

const makeId = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
const dateLabel = (value?: number) => value ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(value) : "Not scheduled";

export default function ProjectManager({ projectId, onNavigate }: {
  projectId?: string;
  onNavigate: (path: string) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState<"active" | "archived">("active");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([listLocalProjects(), projectId ? listProjectNotes(projectId) : Promise.resolve([]), projectId ? listProjectAttachments(projectId) : Promise.resolve([])])
      .then(([rows, savedNotes, savedFiles]) => {
        if (!alive) return;
        setProjects(rows);
        const current = projectId ? rows.find(row => row.id === projectId) ?? null : null;
        setProject(current);
        setNotes(savedNotes);
        setAttachments(savedFiles);
      })
      .catch(reason => { if (alive) setError(reason instanceof Error ? reason.message : "The local project library could not be opened."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [projectId]);

  const grouped = useMemo(() => getProjectCollection(filterProjects(projects, query)), [projects, query]);
  const visibleProjects = grouped[collection];

  async function persist(next: Project) {
    setSaving(true); setError(""); setNotice("");
    try {
      const saved = await updateLocalProject(next);
      if (!saved) throw new Error("The project could not be saved.");
      setProject(saved);
      setProjects(current => current.map(item => item.id === saved.id ? saved : item));
      setNotice("Project changes saved on this device.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The project could not be saved.");
    } finally { setSaving(false); }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const draft = createProjectDraft({
      id: makeId("project"),
      name: String(data.get("name") ?? "")
    }) as Project;
    const validation = validateProjectDraft(draft);
    if (validation) { setError(validation); return; }
    draft.researchQuestion = String(data.get("question") ?? "").trim();
    try {
      setSaving(true); setError("");
      const saved = await createLocalProject(draft);
      if (!saved) throw new Error("Project creation did not return a saved record.");
      setProjects(current => [saved, ...current]);
      onNavigate(projectRoute(saved.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Project creation failed.");
    } finally { setSaving(false); }
  }

  async function archiveProject() {
    if (!project || !window.confirm("Archive this project? It will remain recoverable in the Archived collection.")) return;
    try {
      setSaving(true);
      const saved = await archiveLocalProject(project);
      if (!saved) throw new Error("The project could not be archived.");
      setProjects(current => current.map(item => item.id === saved.id ? saved : item));
      onNavigate("/projects");
      setNotice("Project archived. You can restore it from Archived.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Archive failed."); }
    finally { setSaving(false); }
  }

  async function restoreProjectRecord(item: Project) {
    try {
      setSaving(true);
      const saved = await restoreLocalProject(item);
      if (!saved) throw new Error("The project could not be restored.");
      setProjects(current => current.map(row => row.id === saved.id ? saved : row));
      setNotice("Project restored to your active collection.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Restore failed."); }
    finally { setSaving(false); }
  }

  async function deleteProject() {
    if (!project || !window.confirm("Permanently delete this project and its notes, attachments, literature, review data and research records? This cannot be undone.")) return;
    try {
      setSaving(true);
      await permanentlyDeleteLocalProject(project);
      setProjects(current => current.filter(item => item.id !== project.id));
      onNavigate("/projects");
      setNotice("Project and associated local records permanently deleted.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Permanent deletion failed."); }
    finally { setSaving(false); }
  }

  async function addMilestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || !milestoneTitle.trim()) return;
    const milestone: ResearchMilestone = { id: makeId("milestone"), title: milestoneTitle.trim(), completed: false };
    await persist({ ...project, milestones: [...(project.milestones ?? []), milestone] });
    setMilestoneTitle("");
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || (!noteTitle.trim() && !noteContent.trim())) return;
    const existing = notes.find(note => note.id === editingNoteId);
    const note: ProjectNote = {
      id: existing?.id ?? makeId("note"), projectId: project.id,
      title: noteTitle.trim() || "Untitled note", content: noteContent.trim(),
      tags: existing?.tags ?? [], createdAt: existing?.createdAt ?? Date.now(), updatedAt: Date.now()
    };
    try {
      await saveProjectNote(note);
      setNotes(await listProjectNotes(project.id));
      setNoteTitle(""); setNoteContent(""); setEditingNoteId(null);
      setNotice("Research note saved.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Note save failed."); }
  }

  async function uploadFiles(files: FileList | null) {
    if (!project || !files) return;
    try {
      for (const file of Array.from(files)) {
        if (file.size > 30 * 1024 * 1024) throw new Error(`${file.name} exceeds the 30 MB per-file limit.`);
        await saveProjectAttachment({
          id: makeId("attachment"), projectId: project.id, name: file.name,
          mimeType: file.type || "application/octet-stream", size: file.size,
          blob: file, description: "", createdAt: Date.now()
        });
      }
      setAttachments(await listProjectAttachments(project.id));
      setNotice("Files saved in this browser's local project library.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "File upload failed."); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  }

  if (loading) return <div className="state-panel" role="status">Opening your local project library…</div>;
  if (error && !projects.length) return <div className="state-panel state-error" role="alert">{error}</div>;

  if (projectId && !project) return (
    <Card className="migration-panel">
      <div className="migration-icon"><FolderKanban size={22} /></div>
      <h2>Project not found</h2>
      <p>This project may have been deleted or may not exist in this browser's local library.</p>
      <Button variant="secondary" onClick={() => onNavigate("/projects")}>Back to projects</Button>
    </Card>
  );

  if (project) {
    const updateField = (field: keyof Project, value: unknown) => setProject(current => current ? { ...current, [field]: value } : current);
    return (
      <div className="project-manager">
        <div className="project-manager-toolbar">
          <Button variant="ghost" onClick={() => onNavigate("/projects")}><ArrowLeft size={15} /> All projects</Button>
          <div className="project-manager-actions">
            <Button variant="secondary" onClick={archiveProject} disabled={saving}><Archive size={15} /> Archive</Button>
            <Button variant="primary" onClick={() => void persist(project)} disabled={saving}><Save size={15} /> {saving ? "Saving…" : "Save changes"}</Button>
          </div>
        </div>
        <Card className="project-editor-card">
          <p className="eyebrow">PROJECT WORKSPACE · LOCAL-FIRST</p>
          <label className="project-field"><span>Project name</span><input value={project.name} maxLength={200} onChange={event => updateField("name", event.target.value)} /></label>
          <label className="project-field"><span>Research question</span><textarea rows={3} value={project.researchQuestion ?? ""} onChange={event => updateField("researchQuestion", event.target.value)} /></label>
          <label className="project-field"><span>Objectives (one per line)</span><textarea rows={3} value={(project.objectives ?? []).join("\n")} onChange={event => updateField("objectives", event.target.value.split("\n").map(value => value.trim()).filter(Boolean))} /></label>
          <label className="project-field"><span>Methodology</span><textarea rows={4} value={project.methodology ?? ""} onChange={event => updateField("methodology", event.target.value)} /></label>
          <label className="project-field"><span>Project status</span><select value={project.status ?? "planning"} onChange={event => updateField("status", event.target.value)}><option value="planning">Planning</option><option value="active">Active</option><option value="on-hold">On hold</option><option value="completed">Completed</option></select></label>
          <div className="project-section">
            <div className="section-heading"><div><p className="eyebrow">PLAN & TRACK</p><h2>Milestones</h2></div></div>
            {(project.milestones ?? []).map(milestone => (
              <label className="milestone-row" key={milestone.id}>
                <input type="checkbox" checked={milestone.completed} onChange={event => setProject(current => current ? toggleMilestone(current, milestone.id, event.target.checked) : current)} />
                <span className={milestone.completed ? "is-complete" : ""}>{milestone.title}</span>
                {milestone.dueDate && <small>{milestone.dueDate}</small>}
              </label>
            ))}
            <form className="inline-add-form" onSubmit={addMilestone}><input aria-label="New milestone" placeholder="Add a milestone" value={milestoneTitle} onChange={event => setMilestoneTitle(event.target.value)} /><Button type="submit" variant="secondary" disabled={!milestoneTitle.trim()}><Plus size={14} /> Add</Button></form>
          </div>
          <div className="project-section">
            <div className="section-heading"><div><p className="eyebrow">RESEARCH RECORD</p><h2>Notes</h2></div></div>
            <form className="note-editor" onSubmit={saveNote}>
              <input aria-label="Note title" placeholder="Note title" value={noteTitle} onChange={event => setNoteTitle(event.target.value)} />
              <textarea aria-label="Note content" rows={3} placeholder="Capture an idea, decision, or observation…" value={noteContent} onChange={event => setNoteContent(event.target.value)} />
              <div className="inline-add-form"><Button type="submit" variant="secondary" disabled={!noteTitle.trim() && !noteContent.trim()}><Save size={14} /> {editingNoteId ? "Update note" : "Save note"}</Button>{editingNoteId && <Button type="button" variant="ghost" onClick={() => { setEditingNoteId(null); setNoteTitle(""); setNoteContent(""); }}>Cancel</Button>}</div>
            </form>
            {notes.map(note => <article className="project-note" key={note.id}><div><strong>{note.title}</strong><small>{dateLabel(note.updatedAt)}</small></div><p>{note.content}</p><div className="note-actions"><Button size="sm" variant="ghost" onClick={() => { setEditingNoteId(note.id); setNoteTitle(note.title); setNoteContent(note.content); }}>Edit</Button><Button size="sm" variant="ghost" onClick={async () => { await deleteProjectNote(note.id); setNotes(await listProjectNotes(project.id)); }}>Delete</Button></div></article>)}
          </div>
          <div className="project-section">
            <div className="section-heading"><div><p className="eyebrow">SOURCE MATERIAL</p><h2>Attachments</h2></div><Button variant="secondary" onClick={() => fileRef.current?.click()}><UploadCloud size={14} /> Upload files</Button><input ref={fileRef} hidden type="file" multiple onChange={event => void uploadFiles(event.target.files)} /></div>
            <p className="page-subtitle">Files up to 30 MB each are stored in this browser's local project library.</p>
            {attachments.map(file => <div className="attachment-row" key={file.id}><FilePlus2 size={15} /><span>{file.name}</span><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small><Button size="sm" variant="ghost" onClick={() => { const url = URL.createObjectURL(file.blob); const link = document.createElement("a"); link.href = url; link.download = file.name; link.click(); URL.revokeObjectURL(url); }}><Download size={14} /> Download</Button><Button size="sm" variant="ghost" onClick={async () => { await deleteProjectAttachment(file.id); setAttachments(await listProjectAttachments(project.id)); }}><X size={14} /></Button></div>)}
          </div>
          {notice && <p className="inline-notice" role="status">{notice}</p>}
          {error && <p className="inline-error" role="alert">{error}</p>}
          <div className="danger-zone"><div><strong>Permanent deletion</strong><p>Deletes this project and its related local research records. This cannot be undone.</p></div><Button variant="secondary" onClick={deleteProject} disabled={saving}><Trash2 size={14} /> Delete project</Button></div>
        </Card>
      </div>
    );
  }

  return (
    <div className="project-manager">
      <div className="page-heading"><div><p className="eyebrow">YOUR RESEARCH LIBRARY</p><h1>Projects</h1><p className="page-subtitle">Create, organize and manage your research in one local-first workspace.</p></div></div>
      <Card className="project-create-card">
        <form className="project-create-form" onSubmit={createProject}>
          <label><span>Start a project</span><input name="name" maxLength={200} required placeholder="e.g. Diabetes medication adherence in Rwanda" /></label>
          <label><span>Research question (optional)</span><input name="question" placeholder="What do you want to investigate?" /></label>
          <Button type="submit" variant="primary" disabled={saving}><Plus size={15} /> Create project</Button>
        </form>
      </Card>
      <div className="section-heading project-list-heading">
        <div><p className="eyebrow">LOCAL PROJECT LIBRARY</p><h2>{collection === "active" ? "Active projects" : "Archived projects"} <span className="count-pill">{visibleProjects.length}</span></h2></div>
        <div className="project-manager-filters"><input aria-label="Search projects" placeholder="Search projects and objectives" value={query} onChange={event => setQuery(event.target.value)} /><div className="collection-switch"><button type="button" aria-pressed={collection === "active"} onClick={() => setCollection("active")}>Active ({grouped.active.length})</button><button type="button" aria-pressed={collection === "archived"} onClick={() => setCollection("archived")}>Archived ({grouped.archived.length})</button></div></div>
      </div>
      {notice && <p className="inline-notice" role="status">{notice}</p>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      {visibleProjects.length === 0 ? <div className="state-panel"><FolderKanban size={24} /><strong>{collection === "active" ? "No active projects yet" : "No archived projects"}</strong><span>{collection === "active" ? "Create your first project above. Existing local projects will appear here." : "Archived projects remain recoverable here."}</span></div> :
        <div className="project-grid">{visibleProjects.map(item => <Card className="project-card" key={item.id}><div className="project-card-top"><span className="project-type"><FolderKanban size={14} /> Research project</span><span className="project-status">{item.status ?? "planning"}</span></div><h3>{item.name || "Untitled project"}</h3><p>{item.researchQuestion || "Research question not added yet."}</p><div className="project-card-footer"><span>Updated {dateLabel(item.updatedAt)}</span>{collection === "active" ? <Button size="sm" variant="ghost" onClick={() => onNavigate(projectRoute(item.id))}>Open <ArrowLeft size={14} /></Button> : <Button size="sm" variant="ghost" disabled={saving} onClick={() => void restoreProjectRecord(item)}><RotateCcw size={14} /> Restore</Button>}</div></Card>)}</div>
      }
    </div>
  );
}
