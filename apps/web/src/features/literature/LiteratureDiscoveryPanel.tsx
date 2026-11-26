import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle, ArrowUpRight, BookOpen, Check, Clock3, FileSearch, LoaderCircle, Search, Sparkles, X
} from "lucide-react";
import type { Paper, ProjectSearchHistory } from "../../../../../frontend/src/lib/types";
import { ApiRequestError, searchPapers } from "../../../../../frontend/src/lib/api";
import { listProjectSearchHistory, recordProjectSearch } from "../../../../../frontend/src/lib/db";
import { isSavedPaper, safeExternalUrl } from "./literatureModel.mjs";
import "./literature-discovery.css";

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatCitations(value?: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value.toLocaleString()
    : "";
}

export default function LiteratureDiscoveryPanel({
  projectId,
  papers,
  onSavePaper,
  onOpenLibrary
}: {
  projectId: string;
  papers: Paper[];
  onSavePaper: (paper: Paper) => Promise<boolean>;
  onOpenLibrary: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Paper[]>([]);
  const [history, setHistory] = useState<ProjectSearchHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);
  const [searched, setSearched] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const searchSequence = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const savedResultCount = useMemo(
    () => results.filter(paper => isSavedPaper(paper, papers)).length,
    [results, papers]
  );
  const recentSearches = useMemo(() => {
    const seen = new Set<string>();
    return history.filter(item => {
      const key = item.query.trim().replace(/\s+/g, " ").toLocaleLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 6);
  }, [history]);

  useEffect(() => {
    let active = true;
    listProjectSearchHistory(projectId)
      .then(items => { if (active) setHistory(items); })
      .catch(() => { if (active) setHistory([]); });
    return () => {
      active = false;
      searchSequence.current += 1;
    };
  }, [projectId]);

  useEffect(() => {
    if (retryAfterSeconds <= 0) return;
    const timeout = window.setTimeout(() => {
      setRetryAfterSeconds(current => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [retryAfterSeconds]);

  const runSearch = async (value: string) => {
    const clean = value.trim();
    if (retryAfterSeconds > 0) {
      setError("Academic search is temporarily paused. Try again in " + retryAfterSeconds + " seconds.");
      return;
    }
    if (clean.length < 3) {
      setError("Enter at least 3 characters to search academic literature.");
      return;
    }
    if (clean.length > 500) {
      setError("Search queries must be 500 characters or fewer.");
      return;
    }
    const requestId = ++searchSequence.current;
    setQuery(clean);
    setLoading(true);
    setError("");
    setNotice("");
    setSearched(true);
    setResults([]);
    try {
      const response = await searchPapers(clean, 12);
      if (requestId !== searchSequence.current) return;
      setResults(Array.isArray(response.papers) ? response.papers : []);
      try {
        await recordProjectSearch({ id: crypto.randomUUID(), projectId, query: clean, searchedAt: Date.now() });
        const savedHistory = await listProjectSearchHistory(projectId);
        if (requestId === searchSequence.current) setHistory(savedHistory);
      } catch (historyError) {
        const reason = historyError instanceof Error ? historyError.message : "Unknown local storage error.";
        setNotice("Search completed. Recent-search history could not be saved: " + reason);
      }
    } catch (cause) {
      if (requestId === searchSequence.current) {
        setResults([]);
        const retrySeconds = cause instanceof ApiRequestError ? cause.retryAfterSeconds : 0;
        if (retrySeconds > 0) {
          setRetryAfterSeconds(retrySeconds);
          setError("Academic search rate limit reached. Retry in " + retrySeconds + " seconds.");
        } else {
          setError(cause instanceof Error ? cause.message : "The literature search could not be completed. Please try again.");
        }
      }
    } finally {
      if (requestId === searchSequence.current) setLoading(false);
    }
  };

  const clearSearch = () => {
    searchSequence.current += 1;
    setQuery("");
    setResults([]);
    setLoading(false);
    setError("");
    setNotice("");
    setSearched(false);
    inputRef.current?.focus();
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    void runSearch(query);
  };

  const savePaper = async (paper: Paper) => {
    const key = paper.doi || paper.url || paper.title;
    setSaving(key);
    setError("");
    setNotice("");
    try {
      const added = await onSavePaper(paper);
      setNotice(added ? "Paper saved to this project's research library." : "This paper is already in the project library.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this paper.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="literature-discovery" aria-labelledby="literature-discovery-title">
      <div className="literature-intro">
        <div>
          <p className="eyebrow"><Sparkles size={13} /> RESEARCH DISCOVERY</p>
          <h2 id="literature-discovery-title">Find the research that moves your work forward.</h2>
          <p>Search academic literature, review available metadata and save relevant papers directly to this project's library.</p>
        </div>
        <div className="literature-source"><BookOpen size={21} /><span>Academic literature</span></div>
      </div>

      <form className="literature-search" role="search" aria-label="Search academic literature" aria-busy={loading} onSubmit={submitSearch}>
        <Search size={18} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          maxLength={500}
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Try: childhood immunization timeliness in sub-Saharan Africa"
          aria-label="Search academic literature"
        />
        {query && <button type="button" className="literature-clear" aria-label="Clear search query" onClick={clearSearch}><X size={15} /></button>}
        <button type="submit" disabled={loading || retryAfterSeconds > 0 || query.trim().length < 3}>
          {loading ? <><LoaderCircle className="literature-spin" size={15} /> Searching</> : "Search papers"}
        </button>
      </form>
      <p className="literature-hint">Powered by Semantic Scholar · Enter at least 3 characters. This is not an exhaustive systematic-review search.</p>

      {recentSearches.length > 0 && <div className="literature-history">
        <p className="literature-label"><Clock3 size={13} /> RECENT SEARCHES</p>
        <div className="literature-history-list">
          {recentSearches.map(item => <button type="button" key={item.id} disabled={loading || retryAfterSeconds > 0} onClick={() => void runSearch(item.query)}>{item.query}</button>)}
        </div>
      </div>}

      {error && <div className="literature-alert" role="alert">
        <AlertTriangle size={16} /><span>{error}</span>
        {query.trim().length >= 3 && <button type="button" disabled={retryAfterSeconds > 0} onClick={() => void runSearch(query)}>{retryAfterSeconds > 0 ? "Retry in " + retryAfterSeconds + "s" : "Try again"}</button>}
      </div>}
      {notice && <div className="literature-notice" role="status"><Check size={15} /><span>{notice}</span><button type="button" onClick={onOpenLibrary}>View library <ArrowUpRight size={12} /></button></div>}

      <div className="literature-results-heading">
        <div><p className="literature-label"><FileSearch size={13} /> SEARCH RESULTS</p><h3>{loading ? "Searching academic sources…" : searched ? "Literature matching your search" : "Start with a research question"}</h3></div>
        {searched && !loading && <span role="status">{results.length} results · {savedResultCount} already saved</span>}
      </div>

      <div className="literature-results" role="region" aria-label="Literature search results" aria-busy={loading}>
        {loading ? <div className="literature-empty" role="status"><LoaderCircle className="literature-spin" size={22} />Searching Semantic Scholar…</div> :
          results.length > 0 ? results.map((paper, index) => {
            const saved = isSavedPaper(paper, papers);
            const key = paper.doi || paper.url || paper.title;
            const sourceUrl = safeExternalUrl(paper.url);
            const pdfUrl = safeExternalUrl(paper.openAccessPdf);
            const citations = formatCitations(paper.citationCount);
            const published = formatDate(paper.publicationDate);
            return <article className="literature-paper" key={paper.doi || paper.url || paper.title + index}>
              <div className="literature-paper-icon"><BookOpen size={16} /></div>
              <div className="literature-paper-main">
                <span className="literature-source-badge">Semantic Scholar record</span>
                <h4>{paper.title}</h4>
                <p className="literature-authors">{paper.authors?.slice(0, 5).join(", ") || "Authors not provided"}{paper.authors?.length > 5 ? " et al." : ""}{paper.year ? " · " + paper.year : ""}</p>
                <div className="literature-paper-meta">
                  {paper.venue && <span>{paper.venue}</span>}
                  {published && <span>Published {published}</span>}
                  {citations && <span>{citations} citations</span>}
                </div>
                {paper.abstract && <p className="literature-abstract">{paper.abstract}</p>}
                <div className="literature-paper-links">
                  {paper.doi && <span>DOI: {paper.doi}</span>}
                  {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" aria-label={"Open original publication for " + paper.title}>View publication <ArrowUpRight size={12} /></a>}
                  {pdfUrl && <a href={pdfUrl} target="_blank" rel="noreferrer" aria-label={"Open access PDF for " + paper.title}>Open Access PDF <ArrowUpRight size={12} /></a>}
                </div>
              </div>
              <div className="literature-paper-action">
                <button type="button" disabled={saved || saving !== null} aria-label={saved ? "Already saved in library: " + paper.title : "Save " + paper.title + " to this project's library"} onClick={() => void savePaper(paper)}>
                  {saving === key ? <LoaderCircle className="literature-spin" size={14} /> : saved ? <Check size={14} /> : "+"}
                  {saving === key ? "Saving" : saved ? "In library" : "Save paper"}
                </button>
              </div>
            </article>;
          }) :
          searched && !error ? <div className="literature-empty"><Search size={22} /><strong>No papers found</strong><span>Try broader terms, alternate wording or a different population or intervention.</span></div> :
          !searched ? <div className="literature-empty"><FileSearch size={22} /><strong>Your discovery workspace is ready</strong><span>Search for a topic above. Results can be added to your project without re-entering their details.</span></div> : null}
      </div>

      <div className="literature-footer"><span><strong>{papers.length}</strong> papers in this project library</span><button type="button" onClick={onOpenLibrary}>Open research library <ArrowUpRight size={13} /></button></div>
      <p className="literature-disclaimer">Search results are metadata retrieved from Semantic Scholar. Abstracts and publication details may be incomplete; verify the original publication before using it as evidence. This search is not an exhaustive systematic-review search.</p>
    </section>
  );
}
