import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle, ArrowUpRight, BookOpen, Check, Clock3, FileSearch, LoaderCircle,
  Search, Sparkles, X
} from "lucide-react";
import type { Paper, ProjectSearchHistory } from "../lib/types";
import { searchPapers } from "../lib/api";
import { listProjectSearchHistory, recordProjectSearch } from "../lib/db";
import "./research-discovery.css";

type Props = {
  projectId: string;
  papers: Paper[];
  onSavePaper: (paper: Paper) => Promise<boolean>;
  onOpenLibrary: () => void;
};

function normalizeTitle(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}
function normalizeDoi(value: string) {
  return value.toLowerCase().trim().replace(/^https?:\/\/(dx\.)?doi\.org\//, "").replace(/^doi:\s*/, "");
}
function isSaved(paper: Paper, saved: Paper[]) {
  const doi = normalizeDoi(paper.doi || "");
  const title = normalizeTitle(paper.title);
  return saved.some(item =>
    (doi && normalizeDoi(item.doi || "") === doi) ||
    (title && normalizeTitle(item.title) === title)
  );
}
function safeExternalUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function formatPublicationDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function formatCitationCount(value?: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value.toLocaleString()
    : "";
}

export default function ResearchDiscovery({ projectId, papers, onSavePaper, onOpenLibrary }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Paper[]>([]);
  const [history, setHistory] = useState<ProjectSearchHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const noticeIsWarning = /could not|failed|no longer exists|permanently deleted/i.test(notice);
  const [searched, setSearched] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const searchSequence = useRef(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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

  const savedCount = papers.length;
  const savedResultCount = useMemo(
    () => results.filter(paper => isSaved(paper, papers)).length,
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

  const runSearch = async (value: string) => {
    const clean = value.trim();
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
        setError((cause as Error).message || "We couldn't complete the literature search. Please try again.");
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
    searchInputRef.current?.focus();
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
      setError((cause as Error).message || "Could not save this paper.");
    } finally {
      setSaving(null);
    }
  };

  return <section className="rd-shell">
    <div className="rd-intro">
      <div>
        <div className="rd-eyebrow"><Sparkles size={13}/> RESEARCH DISCOVERY</div>
        <h2>Find the research that moves your work forward.</h2>
        <p>Search academic literature, review the available metadata and save relevant papers directly to this project's library.</p>
      </div>
      <div className="rd-source-mark"><BookOpen size={22}/><span>Academic literature</span></div>
    </div>

    <form className="rd-search" role="search" aria-label="Search academic literature" aria-busy={loading} onSubmit={submitSearch}>
      <Search size={19} aria-hidden="true"/>
      <input
        ref={searchInputRef}
        type="search"
        maxLength={500}
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="Try: childhood immunization timeliness in sub-Saharan Africa"
        aria-label="Search academic literature"
      />
      {query && <button type="button" className="rd-clear-search" aria-label="Clear search query" onClick={clearSearch}><X size={15}/></button>}
      <button type="submit" disabled={loading || query.trim().length < 3}>
        {loading ? <><LoaderCircle className="rd-spin" size={16}/> Searching</> : "Search papers"}
      </button>
    </form>
    <div className="rd-search-hint">Search powered by Semantic Scholar · Enter at least 3 characters. Results are not an exhaustive systematic-review search.</div>

    {recentSearches.length > 0 && <div className="rd-history">
      <div className="rd-section-label"><Clock3 size={14}/> RECENT SEARCHES</div>
      <div className="rd-history-list">{recentSearches.map(item =>
        <button type="button" key={item.id} disabled={loading} aria-label={`Search again for ${item.query}`} onClick={() => void runSearch(item.query)}>{item.query}</button>
      )}</div>
    </div>}

    {error && <div className="rd-alert" role="alert">
      <span>{error}</span>
      {query.trim().length >= 3 && <button type="button" onClick={() => void runSearch(query)}>Try search again</button>}
    </div>}
    {notice && <div className={`rd-notice ${noticeIsWarning ? "warning" : ""}`} role="status" aria-live="polite">
      {noticeIsWarning ? <AlertTriangle size={15}/> : <Check size={15}/>}
      <span>{notice}</span>
      {!noticeIsWarning && <button type="button" onClick={onOpenLibrary}>View library <ArrowUpRight size={13}/></button>}
    </div>}

    <div className="rd-results-heading">
      <div><div className="rd-section-label"><FileSearch size={14}/> SEARCH RESULTS</div>
        <h3>{loading ? "Searching academic sources…" : searched ? "Literature matching your search" : "Start with a research question"}</h3>
      </div>
      {searched && !loading && <span role="status" aria-live="polite">{results.length} results · {savedResultCount} already saved</span>}
    </div>

    <div className="rd-result-content" role="region" aria-label="Literature search results" aria-busy={loading}>
      {loading ? <div className="rd-loading" role="status" aria-live="polite"><LoaderCircle className="rd-spin" size={22}/><span>Searching Semantic Scholar…</span></div> :
        results.length > 0 ? <div className="rd-results">{results.map((paper, index) => {
          const saved = isSaved(paper, papers);
          const key = paper.doi || paper.url || paper.title;
          const citations = formatCitationCount(paper.citationCount);
          const published = formatPublicationDate(paper.publicationDate);
          const sourceUrl = safeExternalUrl(paper.url);
          const pdfUrl = safeExternalUrl(paper.openAccessPdf);
          return <article className="rd-paper" key={paper.doi || paper.url || paper.title + index}>
            <div className="rd-paper-icon"><BookOpen size={17}/></div>
            <div className="rd-paper-main">
              <div className="rd-source-badge">Semantic Scholar record</div>
              <h4>{paper.title}</h4>
              <div className="rd-paper-meta">{paper.authors?.slice(0, 5).join(", ") || "Authors not provided"}{paper.authors?.length > 5 ? " et al." : ""}{paper.year ? " · " + paper.year : ""}</div>
              <div className="rd-paper-details">
                {paper.venue && <span>{paper.venue}</span>}
                {published && <span>Published {published}</span>}
                {citations && <span>{citations} citations</span>}
              </div>
              {paper.abstract && <p>{paper.abstract}</p>}
              <div className="rd-paper-links">
                {paper.doi && <span>DOI: {paper.doi}</span>}
                {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open original publication for ${paper.title}`}>View publication <ArrowUpRight size={12}/></a>}
                {pdfUrl && <a href={pdfUrl} target="_blank" rel="noreferrer" aria-label={`Open access PDF for ${paper.title}`}>Open Access PDF <ArrowUpRight size={12}/></a>}
              </div>
            </div>
            <div className="rd-paper-action">
              <button
                type="button"
                className={saved ? "is-saved" : ""}
                disabled={saved || saving !== null}
                aria-label={saved ? `Already saved in library: ${paper.title}` : `Save ${paper.title} to this project's library`}
                onClick={() => void savePaper(paper)}
              >
                {saving === key ? <LoaderCircle className="rd-spin" size={14}/> : saved ? <Check size={14}/> : <span>＋</span>}
                {saving === key ? "Saving" : saved ? "In library" : "Save paper"}
              </button>
            </div>
          </article>;
        })}</div> :
        searched && !error ? <div className="rd-empty"><Search size={24}/><strong>No papers found</strong><span>Try broader terms, alternate wording or a different population or intervention.</span></div> :
        !searched ? <div className="rd-empty"><FileSearch size={25}/><strong>Your discovery workspace is ready</strong><span>Search for a topic above. Results can be added to your project without re-entering their details.</span></div> : null
      }
    </div>

    <div className="rd-library-footer"><div><strong>{savedCount}</strong><span>papers currently in this project library</span></div><button type="button" onClick={onOpenLibrary}>Open research library <ArrowUpRight size={14}/></button></div>
    <p className="rd-disclaimer">Search results are metadata retrieved from Semantic Scholar. Abstracts and publication details may be incomplete; verify the original publication before using it as evidence. This search is not an exhaustive systematic-review search.</p>
  </section>;
}
