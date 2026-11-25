import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Tabs, TabsList, TabsPanel, TabsTrigger } from "@santi020k/lumen-react";
import {
  ArrowLeft, BookOpen, CalendarDays, Check, Download, FileText, FolderOpen,
  MessageSquareText, Plus, Save, Trash2, UploadCloud
} from "lucide-react";
import type {
  Paper, Project, ProjectAttachment, ProjectNote, ProjectStatus, ResearchMilestone
} from "../../../../../frontend/src/lib/types";
import { projectFingerprint, shouldSaveProjectSnapshot } from "../../../../../frontend/src/lib/project-save-guard.mjs";
import {
  deleteAttachment, deleteNote, getProject, listAttachments, listNotes,
  saveAttachment, saveNote, saveProjectSnapshot
} from "./projectRepository";
import { isDuplicatePaper } from "./projectModel.mjs";
import "./project-workspace.css";

type SaveState = "saved" | "saving" | "error";

function makeId() {
  return crypto.randomUUID();
}

function formatDate(value: number | undefined) {
  if (!value || !Number.isFinite(value)) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(value);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProjectWorkspace({
  projectId,
  onBack
}: {
  projectId: string;
  onBack: () => void;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [paperTitle, setPaperTitle] = useState("");
  const [paperAuthors, setPaperAuthors] = useState("");
  const [paperYear, setPaperYear] = useState("");
  const [paperDoi, setPaperDoi] = useState("");
  const [paperVenue, setPaperVenue] = useState("");
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDueDate, setMilestoneDueDate] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const projectRef = useRef<Project | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lastSavedFingerprintRef = useRef("");
  projectRef.current = project;

  const refreshRelated = useCallback(async () => {
    const [nextNotes, nextAttachments] = await Promise.all([
      listNotes(projectId),
      listAttachments(projectId)
    ]);
    setNotes(nextNotes);
    setAttachments(nextAttachments);
  }, [projectId]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadError("");
    Promise.all([getProject(projectId), listNotes(projectId), listAttachments(projectId)])
      .then(([savedProject, savedNotes, savedAttachments]) => {
        if (!live) return;
        if (!savedProject) {
          setLoadError("This project is no longer available in the local research library.");
          return;
        }
        projectRef.current = savedProject;
        lastSavedFingerprintRef.current = projectFingerprint(savedProject);
        setProject(savedProject);
        setNotes(savedNotes);
        setAttachments(savedAttachments);
      })
      .catch((error) => {
        if (live) setLoadError((error as Error).message || "Could not open this project.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => { live = false; };
  }, [projectId]);

  const persistProject = useCallback((snapshot: Project) => {
    const task = saveQueueRef.current.then(async () => {
      const latest = projectRef.current;
      if (!latest || latest.id !== snapshot.id) return latest;

      const target = shouldSaveProjectSnapshot(snapshot, latest, lastSavedFingerprintRef.current)
        ? snapshot
        : latest;
      if (!shouldSaveProjectSnapshot(target, latest, lastSavedFingerprintRef.current)) return latest;

      setSaveState("saving");
      setSaveError("");
      const saved = await saveProjectSnapshot(target);
      lastSavedFingerprintRef.current = projectFingerprint(saved);

      const current = projectRef.current;
      if (current && current.id === saved.id) {
        const updated = { ...current, revision: saved.revision, updatedAt: saved.updatedAt };
        projectRef.current = updated;
        setProject((value) => value && value.id === saved.id ? updated : value);
      }
      setSaveState("saved");
      return saved;
    });

    saveQueueRef.current = task.then(() => undefined, () => undefined);
    return task.catch((error) => {
      setSaveState("error");
      setSaveError((error as Error).message || "The latest changes could not be saved.");
      throw error;
    });
  }, []);

  useEffect(() => {
    if (!project || loading) return;
    const snapshot = project;
    const timer = window.setTimeout(() => {
      void persistProject(snapshot).catch(() => undefined);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [project, loading, persistProject]);

  useEffect(() => () => {
    const latest = projectRef.current;
    if (latest?.id === projectId) {
      void persistProject(latest).catch(() => undefined);
    }
  }, [projectId, persistProject]);

  const patchProject = (changes: Partial<Project>) => {
    setProject((current) => current ? { ...current, ...changes } : current);
  };

  const handleBack = async () => {
    const latest = projectRef.current;
    try {
      if (latest) await persistProject(latest);
      await saveQueueRef.current;
      onBack();
    } catch {
      setNotice("Your latest edits could not be saved. Resolve the save error before leaving this project.");
    }
  };

  const handleSaveNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!noteTitle.trim() && !noteContent.trim()) return;
    const existing = notes.find((note) => note.id === editingNoteId);
    const now = Date.now();
    const note: ProjectNote = {
      id: existing?.id ?? makeId(),
      projectId,
      title: noteTitle.trim() || "Untitled note",
      content: noteContent.trim(),
      tags: existing?.tags ?? [],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    try {
      await saveNote(note);
      await refreshRelated();
      setNoteTitle("");
      setNoteContent("");
      setEditingNoteId(null);
      setNotice(existing ? "Note updated." : "Note saved locally.");
    } catch (error) {
      setNotice(`Could not save note: ${(error as Error).message}`);
    }
  };

  const handleEditNote = (note: ProjectNote) => {
    setEditingNoteId(note.id);
    setNoteTitle(note.title);
    setNoteContent(note.content);
  };

  const handleDeleteNote = async (note: ProjectNote) => {
    if (!window.confirm(`Delete the note “${note.title}”? This cannot be undone.`)) return;
    try {
      await deleteNote(projectId, note.id);
      await refreshRelated();
      if (editingNoteId === note.id) {
        setEditingNoteId(null);
        setNoteTitle("");
        setNoteContent("");
      }
      setNotice("Note deleted.");
    } catch (error) {
      setNotice(`Could not delete note: ${(error as Error).message}`);
    }
  };

  const handleAddPaper = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!project || !paperTitle.trim()) return;
    const paper: Paper = {
      title: paperTitle.trim(),
      authors: paperAuthors.split(/[,;]\\s*/).map((author) => author.trim()).filter(Boolean),
      year: paperYear ? Number(paperYear) : undefined,
      doi: paperDoi.trim() || undefined,
      venue: paperVenue.trim() || undefined,
      source: "manual"
    };
    if (isDuplicatePaper(project.papers ?? [], paper)) {
      setNotice("This paper already exists in the project library (matching DOI or title).");
      return;
    }
    try {
      const nextProject = { ...project, papers: [...(project.papers ?? []), paper] };
      projectRef.current = nextProject;
      setProject(nextProject);
      const updated = await persistProject(nextProject);
      if (updated && "papers" in updated) {
        projectRef.current = updated as Project;
        setProject(updated as Project);
      }
      setPaperTitle("");
      setPaperAuthors("");
      setPaperYear("");
      setPaperDoi("");
      setPaperVenue("");
      setNotice("Paper added to the project library.");
    } catch (error) {
      setNotice(`Could not add paper: ${(error as Error).message}`);
    }
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files) return;
    const skipped: string[] = [];
    let savedCount = 0;
    try {
      for (const file of Array.from(files)) {
        if (file.size > 30 * 1024 * 1024) {
          skipped.push(file.name);
          continue;
        }
        const attachment: ProjectAttachment = {
          id: makeId(),
          projectId,
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          blob: file,
          description: "",
          createdAt: Date.now()
        };
        await saveAttachment(attachment);
        savedCount += 1;
      }
      await refreshRelated();
      setNotice(skipped.length
        ? `${savedCount} file(s) saved. Skipped files larger than 30 MB: ${skipped.join(", ")}.`
        : `${savedCount} file(s) saved in this browser's project library.`);
    } catch (error) {
      setNotice(`Could not save uploaded files: ${(error as Error).message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const downloadAttachment = (attachment: ProjectAttachment) => {
    const url = URL.createObjectURL(attachment.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = attachment.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDeleteAttachment = async (attachment: ProjectAttachment) => {
    if (!window.confirm(`Delete “${attachment.name}” from this project?`)) return;
    try {
      await deleteAttachment(projectId, attachment.id);
      await refreshRelated();
      setNotice("File deleted.");
    } catch (error) {
      setNotice(`Could not delete file: ${(error as Error).message}`);
    }
  };

  const handleAddMilestone = () => {
    if (!milestoneTitle.trim() || !project) return;
    const milestone: ResearchMilestone = {
      id: makeId(),
      title: milestoneTitle.trim(),
      dueDate: milestoneDueDate || undefined,
      completed: false
    };
    patchProject({ milestones: [...(project.milestones ?? []), milestone] });
    setMilestoneTitle("");
    setMilestoneDueDate("");
  };

  const handleToggleMilestone = (milestoneId: string) => {
    if (!project) return;
    patchProject({
      milestones: (project.milestones ?? []).map((milestone) =>
        milestone.id === milestoneId ? { ...milestone, completed: !milestone.completed } : milestone
      )
    });
  };

  if (loading) {
    return <section className="project-workspace-state" role="status" aria-live="polite">Opening project workspace…</section>;
  }
  if (loadError || !project) {
    return (
      <section className="project-workspace-state" role="alert">
        <h2>Project unavailable</h2>
        <p>{loadError || "This project is no longer available."}</p>
        <Button variant="secondary" onClick={onBack}>Back to projects</Button>
      </section>
    );
  }

  const milestones = project.milestones ?? [];
  const completedMilestones = milestones.filter((item) => item.completed).length;

  return (
    <section className="project-workspace" aria-labelledby="project-workspace-title">
      <header className="project-workspace-header">
        <Button variant="ghost" size="sm" onClick={() => void handleBack()}>
          <ArrowLeft size={16} /> Projects
        </Button>
        <div className="project-workspace-header-meta">
          <span className={`project-save-state is-${saveState}`} role="status" aria-live="polite">
            {saveState === "saving" ? <Save size={14} /> : <Check size={14} />}
            {saveState === "saving" ? "Saving locally…" : saveState === "error" ? "Not saved" : "Saved on this device"}
          </span>
          <span className="project-revision">Revision {project.revision ?? 0}</span>
        </div>
      </header>

      {saveError && <div className="project-inline-error" role="alert">{saveError}</div>}
      {notice && <div className="project-inline-notice" role="status" aria-live="polite">{notice}</div>}

      <div className="project-workspace-heading">
        <div className="project-workspace-eyebrow">PROJECT WORKSPACE</div>
        <input
          id="project-workspace-title"
          className="project-workspace-name"
          aria-label="Project name"
          value={project.name}
          onChange={(event) => patchProject({ name: event.target.value })}
        />
        <div className="project-workspace-subtitle">
          <span>{project.status ?? "planning"}</span>
          <span>Updated {formatDate(project.updatedAt)}</span>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList aria-label="Project workspace sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="library">Research library ({project.papers?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
          <TabsTrigger value="files">Files ({attachments.length})</TabsTrigger>
        </TabsList>

        <TabsPanel value="overview">
          <div className="project-overview-grid">
            <Card className="project-workspace-card">
              <div className="project-card-heading">
                <div><span className="project-card-kicker">RESEARCH BRIEF</span><h2>Research direction</h2></div>
                <BookOpen size={18} />
              </div>
              <label className="project-field">
                <span>Research question</span>
                <textarea value={project.researchQuestion ?? ""} rows={3} onChange={(event) => patchProject({ researchQuestion: event.target.value })} placeholder="What do you want this research to answer?" />
              </label>
              <label className="project-field">
                <span>Objectives (one per line)</span>
                <textarea value={(project.objectives ?? []).join("\n")} rows={4} onChange={(event) => patchProject({ objectives: event.target.value.split("\n").map((value) => value.trim()).filter(Boolean) })} placeholder="Describe the outcomes this project should achieve" />
              </label>
              <label className="project-field">
                <span>Methodology</span>
                <textarea value={project.methodology ?? ""} rows={3} onChange={(event) => patchProject({ methodology: event.target.value })} placeholder="Study design, population, methods and analysis plan" />
              </label>
            </Card>

            <Card className="project-workspace-card">
              <div className="project-card-heading">
                <div><span className="project-card-kicker">PROJECT STATUS</span><h2>Progress and milestones</h2></div>
                <CalendarDays size={18} />
              </div>
              <label className="project-field">
                <span>Status</span>
                <select value={project.status ?? "planning"} onChange={(event) => patchProject({ status: event.target.value as ProjectStatus })}>
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="on-hold">On hold</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              <div className="milestone-summary"><strong>{completedMilestones}/{milestones.length}</strong><span>milestones complete</span></div>
              <form className="project-inline-form" onSubmit={(event) => event.preventDefault()}>
                <label className="project-field"><span>New milestone</span><input value={milestoneTitle} onChange={(event) => setMilestoneTitle(event.target.value)} placeholder="e.g. Finalize protocol" /></label>
                <label className="project-field"><span>Due date</span><input type="date" value={milestoneDueDate} onChange={(event) => setMilestoneDueDate(event.target.value)} /></label>
                <Button type="button" size="sm" disabled={!milestoneTitle.trim()} onClick={handleAddMilestone}><Plus size={15} /> Add milestone</Button>
              </form>
              {milestones.length === 0 ? (
                <p className="project-muted-copy">Add milestones to make the next steps visible.</p>
              ) : (
                <ul className="milestone-list">
                  {milestones.map((milestone) => (
                    <li key={milestone.id}>
                      <label><input type="checkbox" checked={milestone.completed} onChange={() => handleToggleMilestone(milestone.id)} /><span className={milestone.completed ? "is-complete" : ""}>{milestone.title}</span></label>
                      <time>{milestone.dueDate || "No due date"}</time>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </TabsPanel>

        <TabsPanel value="library">
          <Card className="project-workspace-card">
            <div className="project-card-heading"><div><span className="project-card-kicker">SOURCE RECORDS</span><h2>Research library</h2></div><FolderOpen size={18} /></div>
            <form className="project-form-grid" onSubmit={handleAddPaper}>
              <label className="project-field"><span>Paper title</span><input value={paperTitle} onChange={(event) => setPaperTitle(event.target.value)} required /></label>
              <label className="project-field"><span>Authors (comma separated)</span><input value={paperAuthors} onChange={(event) => setPaperAuthors(event.target.value)} /></label>
              <label className="project-field"><span>Year</span><input type="number" min="1800" max="2200" value={paperYear} onChange={(event) => setPaperYear(event.target.value)} /></label>
              <label className="project-field"><span>DOI</span><input value={paperDoi} onChange={(event) => setPaperDoi(event.target.value)} /></label>
              <label className="project-field"><span>Journal / venue</span><input value={paperVenue} onChange={(event) => setPaperVenue(event.target.value)} /></label>
              <div className="project-form-actions"><Button type="submit" disabled={!paperTitle.trim()}><Plus size={15} /> Add source</Button></div>
            </form>
            {(project.papers ?? []).length === 0 ? <p className="project-muted-copy">No sources have been added to this project yet.</p> : (
              <ul className="project-record-list">
                {(project.papers ?? []).map((paper, index) => (
                  <li key={`${paper.doi ?? paper.title}-${index}`}>
                    <div><strong>{paper.title}</strong><p>{paper.authors?.join(", ") || "Author details not recorded"}{paper.year ? ` · ${paper.year}` : ""}{paper.venue ? ` · ${paper.venue}` : ""}</p>{paper.doi && <small>DOI: {paper.doi}</small>}</div>
                    <span>{paper.source ?? "imported"}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsPanel>

        <TabsPanel value="notes">
          <div className="project-notes-grid">
            <Card className="project-workspace-card">
              <div className="project-card-heading"><div><span className="project-card-kicker">WORKING NOTES</span><h2>{editingNoteId ? "Edit note" : "New note"}</h2></div><MessageSquareText size={18} /></div>
              <form onSubmit={(event) => void handleSaveNote(event)}>
                <label className="project-field"><span>Note title</span><input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} placeholder="Give this note a title" /></label>
                <label className="project-field"><span>Content</span><textarea value={noteContent} onChange={(event) => setNoteContent(event.target.value)} rows={8} placeholder="Record decisions, observations or ideas…" /></label>
                <div className="project-form-actions">
                  <Button type="submit" disabled={!noteTitle.trim() && !noteContent.trim()}><Save size={15} /> Save note</Button>
                  {editingNoteId && <Button type="button" variant="ghost" onClick={() => { setEditingNoteId(null); setNoteTitle(""); setNoteContent(""); }}>Cancel edit</Button>}
                </div>
              </form>
            </Card>
            <Card className="project-workspace-card">
              <div className="project-card-heading"><div><span className="project-card-kicker">SAVED LOCALLY</span><h2>Project notes</h2></div><span>{notes.length}</span></div>
              {notes.length === 0 ? <p className="project-muted-copy">Your project notes will appear here.</p> : (
                <ul className="project-note-list">
                  {notes.map((note) => (
                    <li key={note.id}>
                      <div><strong>{note.title}</strong><p>{note.content}</p><time>{formatDate(note.updatedAt)}</time></div>
                      <div className="project-record-actions">
                        <Button size="sm" variant="ghost" onClick={() => handleEditNote(note)}>Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => void handleDeleteNote(note)}><Trash2 size={14} /> Delete</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </TabsPanel>

        <TabsPanel value="files">
          <Card className="project-workspace-card">
            <div className="project-card-heading"><div><span className="project-card-kicker">LOCAL ATTACHMENTS</span><h2>Project files</h2></div><FileText size={18} /></div>
            <div className="project-upload-row">
              <p>Files are stored in this browser's local project library. Maximum 30 MB per file.</p>
              <Button type="button" onClick={() => fileInputRef.current?.click()}><UploadCloud size={15} /> Upload files</Button>
              <input ref={fileInputRef} type="file" multiple hidden onChange={(event) => void handleUploadFiles(event.target.files)} />
            </div>
            {attachments.length === 0 ? <p className="project-muted-copy">No files are attached to this project yet.</p> : (
              <ul className="project-record-list">
                {attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <div><strong>{attachment.name}</strong><p>{attachment.mimeType} · {formatBytes(attachment.size)} · Added {formatDate(attachment.createdAt)}</p></div>
                    <div className="project-record-actions">
                      <Button size="sm" variant="ghost" onClick={() => downloadAttachment(attachment)}><Download size={14} /> Download</Button>
                      <Button size="sm" variant="ghost" onClick={() => void handleDeleteAttachment(attachment)}><Trash2 size={14} /> Delete</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsPanel>
      </Tabs>
    </section>
  );
}
