import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import "./project-workspace.css";
import ResearchDiscovery from "./ResearchDiscovery";
import DataMethodsLab from "./DataMethodsLab";
import {
  ArrowLeft, BookOpen, Check, ClipboardList, Download, FilePlus2,
  FileText, FolderOpen, Link2, MessageSquareText, Plus, Save, Search, Trash2,
  UploadCloud, X, FlaskConical
} from "lucide-react";
import type { Paper, Project, ProjectAttachment, ProjectNote, ProjectStatus, ResearchMilestone } from "../lib/types";
import {
  deleteProjectAttachment, deleteProjectNote, listProjectAttachments, listProjectNotes,
  loadProject, saveProject, saveProjectAttachment, saveProjectNote
} from "../lib/db";

const uid = () => Math.random().toString(36).slice(2, 11);
const emptyPaper = { title: "", authors: "", year: "", venue: "", doi: "", url: "", abstract: "" };

export default function ProjectWorkspace({
  projectId, onBack, onOpenStudio
}: { projectId: string; onBack: () => void; onOpenStudio: () => void }) {
  const [project, setProject] = useState<Project | null>(null);
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [section, setSection] = useState<"overview" | "library" | "notes" | "discover" | "methods">("overview");
  const [loading, setLoading] = useState(true);
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [source, setSource] = useState(emptyPaper);
  const [sourceQuery, setSourceQuery] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const projectRef = useRef<Project | null>(null);
  const paperSaveQueue = useRef<Promise<void>>(Promise.resolve());
  projectRef.current = project;

  const refreshRelated = async () => {
    const [nextNotes, nextAttachments] = await Promise.all([
      listProjectNotes(projectId), listProjectAttachments(projectId)
    ]);
    setNotes(nextNotes); setAttachments(nextAttachments);
  };

  useEffect(() => {
    let live = true;
    setLoading(true);
    Promise.all([loadProject(projectId), listProjectNotes(projectId), listProjectAttachments(projectId)])
      .then(([saved, savedNotes, savedAttachments]) => {
        if (!live) return;
        if (saved) setProject(saved);
        setNotes(savedNotes); setAttachments(savedAttachments);
      })
      .catch(error => setNotice((error as Error).message))
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [projectId]);

  useEffect(() => {
    if (!project) return;
    const timer = window.setTimeout(() => {
      saveProject(project).catch(error => setNotice("Could not save project: " + (error as Error).message));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [project]);

  useEffect(() => () => {
    const latest = projectRef.current;
    if (latest?.id === projectId) void saveProject(latest);
  }, [projectId]);

  const patch = (changes: Partial<Project>) => setProject(current => current ? { ...current, ...changes } : current);
  const navigateAfterSave = async (action: () => void) => {
    if (!project) return;
    try { await saveProject(project); action(); }
    catch (error) { setNotice("Could not save the latest project changes: " + (error as Error).message); }
  };
  const papers = project?.papers || [];
  const filteredPapers = useMemo(() => papers.filter(p =>
    [p.title, ...(p.authors || []), p.doi || "", p.venue || ""].join(" ").toLowerCase().includes(sourceQuery.toLowerCase())
  ), [papers, sourceQuery]);

  const saveDiscoveredPaper = async (paper: Paper) => {
    const saveTask = paperSaveQueue.current.then(async () => {
      const latest = projectRef.current;
      if (!latest || latest.id !== projectId) return false;
      const normalizeTitle = (value: string) => value.normalize("NFKC").toLocaleLowerCase().replace(/[^\\p{L}\\p{N}]/gu, "");
      const normalizeDoi = (value: string) => value.toLowerCase().trim().replace(/^https?:\\/\\/(dx\\.)?doi\\.org\\//, "").replace(/^doi:\\s*/, "");
      const doi = normalizeDoi(paper.doi || "");
      const title = normalizeTitle(paper.title);
      const duplicate = latest.papers.some(item =>
        (doi && normalizeDoi(item.doi || "") === doi) ||
        (title && normalizeTitle(item.title) === title)
      );
      if (duplicate) return false;
      const next = { ...latest, papers: [...latest.papers, paper] };
      await saveProject(next);
      projectRef.current = next;
      setProject(next);
      setNotice("Paper saved to the project library.");
      return true;
    });
    paperSaveQueue.current = saveTask.then(() => undefined, () => undefined);
    return saveTask;
  };

  const addSource = async (event: FormEvent) => {
    event.preventDefault();
    if (!project || !source.title.trim()) return;
    const paper: Paper = {
      title: source.title.trim(),
      authors: source.authors.split(/[,;]\s*/).map(value => value.trim()).filter(Boolean),
      year: source.year ? Number(source.year) : undefined,
      venue: source.venue.trim() || undefined,
      doi: source.doi.trim() || undefined,
      url: source.url.trim() || undefined,
      abstract: source.abstract.trim() || undefined
    };
    const next = { ...project, papers: [...project.papers, paper] };
    try {
      await saveProject(next);
      setProject(next);
      setSource(emptyPaper); setShowSourceForm(false);
      setNotice("Source added to this project's library.");
    } catch (error) {
      setNotice("Could not save this source: " + (error as Error).message);
    }
  };

  const saveNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!noteTitle.trim() && !noteContent.trim()) return;
    const existing = notes.find(note => note.id === editingNote);
    const note: ProjectNote = {
      id: existing?.id || uid(), projectId, title: noteTitle.trim() || "Untitled note",
      content: noteContent.trim(), tags: existing?.tags || [],
      createdAt: existing?.createdAt || Date.now(), updatedAt: Date.now()
    };
    try {
      await saveProjectNote(note);
      setNoteTitle(""); setNoteContent(""); setEditingNote(null);
      await refreshRelated();
      setNotice("Note saved.");
    } catch (error) {
      setNotice("Could not save this note: " + (error as Error).message);
    }
  };

  const editNote = (note: ProjectNote) => {
    setEditingNote(note.id); setNoteTitle(note.title); setNoteContent(note.content); setSection("notes");
  };

  const uploadFiles = async (files: FileList | null) => {
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
          id: uid(), projectId, name: file.name, mimeType: file.type || "application/octet-stream",
          size: file.size, blob: file, description: "", createdAt: Date.now()
        };
        await saveProjectAttachment(attachment);
        savedCount += 1;
      }
      await refreshRelated();
      setNotice(skipped.length
        ? `${savedCount} file(s) saved. Skipped files larger than 30 MB: ${skipped.join(", ")}.`
        : `${savedCount} file(s) saved in this browser's project library.`);
    } catch (error) {
      setNotice("Could not save uploaded files: " + (error as Error).message);
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const downloadAttachment = (file: ProjectAttachment) => {
    const url = URL.createObjectURL(file.blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = file.name; anchor.click();
    URL.revokeObjectURL(url);
  };

  const addMilestone = () => {
    if (!project) return;
    const title = window.prompt("Milestone name");
    if (!title?.trim()) return;
    const milestone: ResearchMilestone = { id: uid(), title: title.trim(), completed: false };
    patch({ milestones: [...(project.milestones || []), milestone] });
  };

  if (loading) return <div className="project-loading">Opening project workspace…</div>;
  if (!project) return <div className="project-loading"><p>We couldn't find this project in local storage.</p><button onClick={onBack}>Back to Research Station</button></div>;

  const completedMilestones = (project.milestones || []).filter(item => item.completed).length;
  const status = project.status || "planning";

  return <div className="project-workspace">
    <header className="pw-topbar">
      <button className="pw-back" onClick={() => void navigateAfterSave(onBack)}><ArrowLeft size={15}/> Research Station</button>
      <div className="pw-brand"><span className="pw-brand-mark">P</span><span>PaperOrchestra</span><i>PROJECT WORKSPACE</i></div>
      <button className="pw-writing" onClick={() => void navigateAfterSave(onOpenStudio)}><BookOpen size={15}/> Open Writing Studio</button>
    </header>
    <main className="pw-main">
      <div className="pw-breadcrumb">YOUR PROJECTS <span>/</span> PROJECT WORKSPACE</div>
      <section className="pw-heading">
        <div><div className="pw-eyebrow">RESEARCH PROJECT</div><input className="pw-project-name" value={project.name} onChange={e => patch({ name: e.target.value })} aria-label="Project name"/>
          <p>Keep your research question, sources, files and working notes together.</p></div>
        <label className="pw-status">PROJECT STATUS
          <select value={status} onChange={e => patch({ status: e.target.value as ProjectStatus })}>
            <option value="planning">Planning</option><option value="active">Active</option><option value="on-hold">On hold</option><option value="completed">Completed</option>
          </select>
        </label>
      </section>

      <nav className="pw-tabs">
        <button className={section === "overview" ? "selected" : ""} onClick={() => setSection("overview")}><ClipboardList size={15}/> Overview</button>
        <button className={section === "library" ? "selected" : ""} onClick={() => setSection("library")}><FolderOpen size={15}/> Research library <span>{papers.length + attachments.length}</span></button>
        <button className={section === "notes" ? "selected" : ""} onClick={() => setSection("notes")}><MessageSquareText size={15}/> Notes <span>{notes.length}</span></button>
        <button className={section === "discover" ? "selected" : ""} onClick={() => setSection("discover")}><Search size={15}/> Discover</button>
        <button className={section === "methods" ? "selected" : ""} onClick={() => setSection("methods")}><FlaskConical size={15}/> Data & Methods</button>
      </nav>
      {notice && <div className="pw-global-notice" role="status"><Check size={14}/><span>{notice}</span></div>}

      {section === "overview" && <div className="pw-overview">
        <div className="pw-main-column">
          <section className="pw-panel">
            <div className="pw-panel-title"><div><span>01</span><h2>Research brief</h2></div><small>Autosaved locally</small></div>
            <label className="pw-field">Research question
              <textarea rows={3} value={project.researchQuestion ?? project.notes.replace(/^Research question:\s*/i, "")} onChange={e => patch({ researchQuestion: e.target.value })} placeholder="What is the central question your research will answer?"/>
            </label>
            <label className="pw-field">Research objectives
              <textarea rows={4} value={(project.objectives || []).join("\n")} onChange={e => patch({ objectives: e.target.value.split("\n").map(v => v.trim()).filter(Boolean) })} placeholder={"Enter one objective per line\n1. Describe…\n2. Assess…\n3. Explore…"}/>
            </label>
            <label className="pw-field">Methodology and approach
              <textarea rows={4} value={project.methodology || ""} onChange={e => patch({ methodology: e.target.value })} placeholder="Study design, setting, population, data sources and analysis plan…"/>
            </label>
          </section>
          <section className="pw-panel">
            <div className="pw-panel-title"><div><span>02</span><h2>Milestones</h2></div><button className="pw-text-action" onClick={addMilestone}><Plus size={14}/> Add milestone</button></div>
            {(project.milestones || []).length === 0 ? <div className="pw-empty-small">Break the research into milestones you can track as the project develops.</div> :
              <div className="pw-milestones">{(project.milestones || []).map(item => <div className="pw-milestone" key={item.id}>
                <input type="checkbox" checked={item.completed} onChange={e => patch({ milestones: (project.milestones || []).map(m => m.id === item.id ? { ...m, completed: e.target.checked } : m) })}/>
                <span className={item.completed ? "done" : ""}>{item.title}</span>
                <button title="Remove milestone" onClick={() => patch({ milestones: (project.milestones || []).filter(m => m.id !== item.id) })}><X size={13}/></button>
              </div>)}</div>}
          </section>
        </div>
        <aside className="pw-side-column">
          <section className="pw-summary-card"><div className="pw-eyebrow">PROJECT SNAPSHOT</div><div className="pw-stat-grid">
            <div><strong>{papers.length}</strong><span>Sources</span></div><div><strong>{attachments.length}</strong><span>Files</span></div><div><strong>{notes.length}</strong><span>Notes</span></div>
          </div><div className="pw-summary-line"><span>Milestones complete</span><b>{completedMilestones}/{(project.milestones || []).length}</b></div>
          <div className="pw-mini-progress"><i style={{ width: (project.milestones?.length ? completedMilestones / project.milestones.length * 100 : 0) + "%" }}/></div>
          <button className="pw-open-studio" onClick={() => void navigateAfterSave(onOpenStudio)}>Continue to Writing Studio <BookOpen size={14}/></button></section>
          <section className="pw-tip"><strong>Research library</strong><p>Keep papers and original documents here. Later workspaces will reuse these materials for screening, evidence extraction and manuscript writing.</p><button onClick={() => setSection("library")}>Manage sources <Link2 size={13}/></button></section>
        </aside>
      </div>}

      {section === "library" && <div className="pw-library">
        <div className="pw-library-head"><div><h2>Research library</h2><p>Sources and files attached to this project.</p></div><div className="pw-library-actions">
          <button className="pw-secondary" onClick={() => fileInput.current?.click()}><UploadCloud size={14}/> Upload files</button>
          <button className="pw-primary" onClick={() => setShowSourceForm(v => !v)}><FilePlus2 size={14}/> Add source</button>
          <input ref={fileInput} type="file" multiple accept=".pdf,.doc,.docx,.csv,.tsv,.xlsx,.xls,.txt,.md,.ris,.bib,.json" hidden onChange={e => void uploadFiles(e.target.files)}/>
        </div></div>
        {showSourceForm && <form className="pw-source-form" onSubmit={addSource}>
          <div className="pw-form-head"><strong>Add a reference</strong><button type="button" onClick={() => setShowSourceForm(false)}><X size={15}/></button></div>
          <label>Title<input required value={source.title} onChange={e => setSource({ ...source, title: e.target.value })} placeholder="Article or book title"/></label>
          <div className="pw-form-row"><label>Authors<input value={source.authors} onChange={e => setSource({ ...source, authors: e.target.value })} placeholder="Separate authors with commas"/></label><label>Year<input type="number" min="1500" max="2200" value={source.year} onChange={e => setSource({ ...source, year: e.target.value })} placeholder="2026"/></label></div>
          <div className="pw-form-row"><label>Journal / publisher<input value={source.venue} onChange={e => setSource({ ...source, venue: e.target.value })}/></label><label>DOI<input value={source.doi} onChange={e => setSource({ ...source, doi: e.target.value })} placeholder="10.xxxx/xxxxx"/></label></div>
          <label>URL<input type="url" value={source.url} onChange={e => setSource({ ...source, url: e.target.value })} placeholder="https://…"/></label>
          <label>Abstract / description<textarea rows={3} value={source.abstract} onChange={e => setSource({ ...source, abstract: e.target.value })}/></label>
          <div className="pw-form-actions"><button type="button" className="pw-secondary" onClick={() => setShowSourceForm(false)}>Cancel</button><button className="pw-primary" type="submit"><Save size={14}/> Save reference</button></div>
        </form>}
        <label className="pw-search"><Search size={14}/><input value={sourceQuery} onChange={e => setSourceQuery(e.target.value)} placeholder="Search titles, authors, DOI…"/></label>
        <div className="pw-library-section"><h3><BookOpen size={15}/> References <span>{filteredPapers.length}</span></h3>
          {filteredPapers.length === 0 ? <div className="pw-empty">No references yet. Add a reference manually or import one through a future discovery workflow.</div> :
            filteredPapers.map((paper) => <article className="pw-reference" key={paper.doi || paper.title}>
              <div className="pw-ref-icon"><FileText size={16}/></div><div className="pw-ref-body"><strong>{paper.title}</strong><p>{paper.authors?.join(", ") || "Author not recorded"}{paper.year ? " · " + paper.year : ""}{paper.venue ? " · " + paper.venue : ""}</p>{paper.doi && <small>DOI: {paper.doi}</small>}</div>
              <div className="pw-ref-actions">{paper.url && <a href={paper.url} target="_blank" rel="noreferrer">Open <Link2 size={12}/></a>}<button title="Remove reference" onClick={() => {
                if (window.confirm("Remove this reference from the project?")) patch({ papers: project.papers.filter((item) => item !== paper) });
              }}><Trash2 size={14}/></button></div>
            </article>)}
        </div>
        <div className="pw-library-section"><h3><FolderOpen size={15}/> Uploaded files <span>{attachments.length}</span></h3>
          {attachments.length === 0 ? <div className="pw-empty">PDFs, datasets and supporting documents uploaded here are stored in this browser.</div> :
            attachments.map(file => <article className="pw-reference" key={file.id}><div className="pw-ref-icon"><FileText size={16}/></div><div className="pw-ref-body"><strong>{file.name}</strong><p>{(file.size / 1024 / 1024).toFixed(2)} MB · {file.mimeType}</p></div><div className="pw-ref-actions"><button title="Download file" onClick={() => downloadAttachment(file)}><Download size={14}/></button><button title="Delete file" onClick={async () => { if (window.confirm("Delete this uploaded file?")) { await deleteProjectAttachment(file.id); await refreshRelated(); } }}><Trash2 size={14}/></button></div></article>)}
        </div>
      </div>}

      {section === "discover" && <ResearchDiscovery projectId={projectId} papers={papers} onSavePaper={saveDiscoveredPaper} onOpenLibrary={() => setSection("library")}/>}

      {section === "methods" && <DataMethodsLab attachments={attachments}/>}

      {section === "notes" && <div className="pw-notes-layout">
        <section className="pw-panel pw-note-editor"><div className="pw-panel-title"><div><span>✎</span><h2>{editingNote ? "Edit note" : "New project note"}</h2></div>{editingNote && <button className="pw-text-action" onClick={() => { setEditingNote(null); setNoteTitle(""); setNoteContent(""); }}>Cancel edit</button>}</div>
          <form onSubmit={saveNote}><label className="pw-field">Note title<input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="e.g. Inclusion criteria decision"/></label><label className="pw-field">Note content<textarea rows={10} value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Record an idea, observation, decision or meeting note…"/></label><button className="pw-primary" type="submit"><Save size={14}/> Save note</button></form>
        </section>
        <section className="pw-note-list"><div className="pw-panel-title"><div><span>03</span><h2>Saved notes</h2></div><small>{notes.length} notes</small></div>
          {notes.length === 0 ? <div className="pw-empty">Your project notes will appear here.</div> : notes.map(note => <article className="pw-note-card" key={note.id}><div><strong>{note.title}</strong><small>{new Date(note.updatedAt).toLocaleString()}</small></div><p>{note.content || "No content"}</p><footer><button onClick={() => editNote(note)}>Edit</button><button onClick={async () => { if (window.confirm("Delete this note?")) { await deleteProjectNote(note.id); await refreshRelated(); } }}><Trash2 size={13}/> Delete</button></footer></article>)}
        </section>
      </div>}
      <footer className="pw-footer"><span>PaperOrchestra · Local-first research workspace</span><span>Project data is stored in this browser · Last saved automatically</span></footer>
    </main>
  </div>;
}
