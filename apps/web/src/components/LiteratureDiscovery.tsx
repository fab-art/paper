import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BookOpen, Download, ExternalLink, FileText, History, Search, ShieldCheck } from "lucide-react";
import { Button, Card } from "@santi020k/lumen-react";
import type { Paper, Project, ProjectSearchHistory } from "../../../../frontend/src/lib/types";
import { searchPapers, ApiRequestError } from "../../../../frontend/src/lib/api";
import { listLocalProjects, updateLocalProject } from "../adapters/legacy-projects";
import { listProjectSearchHistory, recordProjectSearch } from "../../../../frontend/src/lib/db";
import { appendMissingBibtex, deduplicatePapers, safeExternalUrl, samePaper } from "../domain/literature-discovery.mjs";

const createId = () => globalThis.crypto?.randomUUID?.() ?? ("search-" + Date.now() + "-" + Math.random().toString(36).slice(2));
const paperYear = (paper: Paper) => Number(paper.year ?? 0);

function downloadBibtex(project: Project) {
  const blob = new Blob([project.bibtex || "% No BibTeX references have been saved yet.\n"], { type: "application/x-bibtex;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = (project.name || "research-project").toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-references.bib";
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function LiteratureDiscovery() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Paper[]>([]);
  const [history, setHistory] = useState<ProjectSearchHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retryAfter, setRetryAfter] = useState(0);
  const [openAccessOnly, setOpenAccessOnly] = useState(false);
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [sortBy, setSortBy] = useState<"relevance" | "citations" | "newest">("relevance");

  const selectedProject = projects.find(project => project.id === projectId) ?? null;
  const savedPapers = selectedProject?.papers ?? [];

  useEffect(() => {
    let alive = true;
    listLocalProjects().then(rows => {
      if (!alive) return;
      const active = rows.filter(project => !project.archivedAt);
      setProjects(active);
      setProjectId(active[0]?.id ?? "");
    }).catch(reason => {
      if (alive) setError(reason instanceof Error ? reason.message : "Your local project library could not be opened.");
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!projectId) { setHistory([]); return; }
    listProjectSearchHistory(projectId).then(rows => { if (alive) setHistory(rows); })
      .catch(reason => { if (alive) setError(reason instanceof Error ? reason.message : "Search history could not be loaded."); });
    return () => { alive = false; };
  }, [projectId]);

  const visibleResults = useMemo(() => {
    let rows = results.filter(paper => !openAccessOnly || Boolean(paper.openAccessPdf));
    if (yearFrom) rows = rows.filter(paper => paperYear(paper) >= Number(yearFrom));
    if (yearTo) rows = rows.filter(paper => paperYear(paper) > 0 && paperYear(paper) <= Number(yearTo));
    if (sortBy === "citations") rows = [...rows].sort((a, b) => Number(b.citationCount ?? 0) - Number(a.citationCount ?? 0));
    if (sortBy === "newest") rows = [...rows].sort((a, b) => paperYear(b) - paperYear(a));
    return rows;
  }, [results, openAccessOnly, yearFrom, yearTo, sortBy]);

  async function runSearch(searchQuery = query) {
    const normalized = searchQuery.trim();
    if (normalized.length < 3 || normalized.length > 500) {
      setError("Enter a search query between 3 and 500 characters.");
      return;
    }
    setSearching(true); setError(""); setNotice(""); setRetryAfter(0);
    try {
      const response = await searchPapers(normalized, 20);
      const papers = deduplicatePapers(response.papers.map(paper => ({ ...paper, source: "semantic-scholar" as const })));
      setResults(papers);
      setNotice("Found " + papers.length + " unique records from Semantic Scholar.");
      if (projectId) {
        const entry: ProjectSearchHistory = { id: createId(), projectId, query: normalized, searchedAt: Date.now() };
        await recordProjectSearch(entry);
        setHistory(await listProjectSearchHistory(projectId));
      }
    } catch (reason) {
      setResults([]);
      if (reason instanceof ApiRequestError && reason.status === 429) {
        setRetryAfter(reason.retryAfterSeconds);
        setError(reason.message + (reason.retryAfterSeconds ? " Retry in about " + reason.retryAfterSeconds + " seconds." : ""));
      } else setError(reason instanceof Error ? reason.message : "Literature search failed. Please try again.");
    } finally { setSearching(false); }
  }

  async function savePaper(paper: Paper) {
    if (!selectedProject) { setError("Choose a project before saving a paper."); return; }
    const key = paper.doi || paper.title;
    setSavingId(key); setError(""); setNotice("");
    try {
      const existing = selectedProject.papers ?? [];
      const alreadySaved = existing.some(item => samePaper(item, paper));
      const merged = deduplicatePapers([...existing, paper]);
      const bibtex = appendMissingBibtex(selectedProject.bibtex, [paper]);
      const saved = await updateLocalProject({ ...selectedProject, papers: merged, bibtex });
      if (!saved) throw new Error("The project library did not confirm the save.");
      setProjects(current => current.map(item => item.id === saved.id ? saved : item));
      setNotice(alreadySaved
        ? "This source was already in the project; its metadata has been refreshed."
        : "Paper saved to the selected project and its BibTeX reference added.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The paper could not be saved. Reload the project before retrying.");
    } finally { setSavingId(""); }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch();
  }

  if (loading) return <div className="state-panel" role="status">Opening your local research library…</div>;

  return (
    <div className="literature-workspace">
      <section className="literature-search-panel" aria-labelledby="literature-search-heading">
        <div className="literature-search-intro">
          <span className="literature-icon"><BookOpen size={19} /></span>
          <div>
            <p className="eyebrow">SCHOLARLY SEARCH · SEMANTIC SCHOLAR</p>
            <h2 id="literature-search-heading">Find research worth reading.</h2>
            <p>Search scholarly records, inspect source metadata, then curate the papers you want to keep.</p>
          </div>
        </div>
        <form className="literature-query-form" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="literature-query">Search scholarly literature</label>
          <Search size={18} aria-hidden="true" />
          <input id="literature-query" value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. diabetes treatment adherence in sub-Saharan Africa" minLength={3} maxLength={500} />
          <Button type="submit" disabled={searching || query.trim().length < 3}>{searching ? "Searching…" : "Search papers"}</Button>
        </form>
        <div className="literature-context-row">
          <label className="literature-project-select"><span>Save results to</span><select value={projectId} onChange={event => setProjectId(event.target.value)}><option value="">Search without a project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name || "Untitled project"}</option>)}</select></label>
          <span className="literature-source-note"><ShieldCheck size={14} /> Results attributed to Semantic Scholar</span>
        </div>
        {error && <div className="literature-feedback is-error" role="alert">{error}{retryAfter > 0 && <span>Provider cooldown is active; repeated retries will not bypass it.</span>}</div>}
        {notice && <div className="literature-feedback" role="status">{notice}</div>}
      </section>

      <div className="literature-content-grid">
        <aside className="literature-history" aria-labelledby="search-history-heading">
          <div className="literature-section-title"><History size={15} /><h3 id="search-history-heading">Recent searches</h3></div>
          {!projectId
            ? <p className="literature-muted">Select a project to keep its search history on this device.</p>
            : history.length
              ? <ul>{history.slice(0, 10).map(item => <li key={item.id}><button type="button" onClick={() => { setQuery(item.query); void runSearch(item.query); }}>{item.query}</button><time dateTime={new Date(item.searchedAt).toISOString()}>{new Date(item.searchedAt).toLocaleDateString()}</time></li>)}</ul>
              : <p className="literature-muted">Searches for this project will appear here.</p>}
          <div className="literature-saved-summary">
            <span>Saved in project</span><strong>{savedPapers.length}</strong><small>papers in local library</small>
            {selectedProject && <Button variant="secondary" size="sm" onClick={() => downloadBibtex(selectedProject)} disabled={!selectedProject.bibtex?.trim()}><Download size={14} /> Export BibTeX</Button>}
          </div>
        </aside>

        <section className="literature-results" aria-labelledby="literature-results-heading" aria-live="polite">
          <div className="literature-results-header">
            <div><p className="eyebrow">DISCOVERY RESULTS</p><h2 id="literature-results-heading">{results.length ? visibleResults.length + " papers" : "Search results"} <span className="count-pill">{results.length}</span></h2></div>
            <div className="literature-filters">
              <label><input type="checkbox" checked={openAccessOnly} onChange={event => setOpenAccessOnly(event.target.checked)} /> Open access</label>
              <label>From <input aria-label="Publication year from" inputMode="numeric" value={yearFrom} onChange={event => setYearFrom(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Year" /></label>
              <label>To <input aria-label="Publication year to" inputMode="numeric" value={yearTo} onChange={event => setYearTo(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Year" /></label>
              <label>Sort <select value={sortBy} onChange={event => setSortBy(event.target.value as typeof sortBy)}><option value="relevance">Relevance</option><option value="citations">Most cited</option><option value="newest">Newest</option></select></label>
            </div>
          </div>
          {!results.length && !searching && <div className="literature-empty"><FileText size={24} /><strong>No papers to display yet</strong><span>Run a scholarly search to see matching publications. Search results are discovery leads, not verified evidence.</span></div>}
          {searching && <div className="state-panel" role="status">Searching Semantic Scholar…</div>}
          <div className="literature-paper-list">
            {visibleResults.map((paper, index) => {
              const saved = savedPapers.some(item => samePaper(item, paper));
              const doiPath = paper.doi ? encodeURI(paper.doi).replace(/#/g, "%23").replace(/\?/g, "%3F") : "";
              const doi = doiPath ? safeExternalUrl("https://doi.org/" + doiPath) : "";
              const paperUrl = safeExternalUrl(paper.url);
              const pdfUrl = safeExternalUrl(paper.openAccessPdf);
              const key = paper.doi || (paper.title + "-" + index);
              return <Card className="literature-paper" key={key}>
                <div className="literature-paper-top"><span className="literature-provider">SEMANTIC SCHOLAR</span><span className="literature-paper-year">{paper.year ?? "Year unavailable"}</span></div>
                <h3>{paper.title || "Untitled paper"}</h3>
                <p className="literature-authors">{paper.authors?.join(", ") || "Author metadata unavailable"}</p>
                <div className="literature-paper-meta">{paper.venue && <span>{paper.venue}</span>}{typeof paper.citationCount === "number" && <span>{paper.citationCount.toLocaleString()} citations</span>}{paper.publicationDate && <span>{paper.publicationDate}</span>}</div>
                {paper.abstract && <details className="literature-abstract"><summary>Read abstract</summary><p>{paper.abstract}</p></details>}
                <div className="literature-paper-actions">
                  {doi && <a href={doi} target="_blank" rel="noreferrer">DOI <ExternalLink size={12} /></a>}
                  {paperUrl && <a href={paperUrl} target="_blank" rel="noreferrer">Publisher / source <ExternalLink size={12} /></a>}
                  {pdfUrl && <a href={pdfUrl} target="_blank" rel="noreferrer">Open-access PDF <ExternalLink size={12} /></a>}
                  <Button size="sm" variant={saved ? "secondary" : "default"} disabled={!selectedProject || Boolean(savingId)} onClick={() => void savePaper(paper)}>{savingId === key ? "Saving…" : saved ? "Refresh metadata" : "Save to project"}</Button>
                </div>
              </Card>;
            })}
          </div>
          {results.length > 0 && visibleResults.length === 0 && <div className="literature-empty"><strong>No papers match these filters</strong><span>Adjust the year range or turn off the open-access filter.</span></div>}
        </section>
      </div>
      <p className="literature-disclaimer">Bibliographic metadata is supplied by Semantic Scholar and may be incomplete. Confirm publication details against the publisher record before citing. Search results are discovery leads, not quality assessments.</p>
    </div>
  );
}
