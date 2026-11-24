import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight, BookOpen, Check, Clock3, FileSearch, LoaderCircle,
  Search, Sparkles
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

function normalize(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function isSaved(paper: Paper, saved: Paper[]) {
  const doi = normalize(paper.doi || "");
  const title = normalize(paper.title);
  return saved.some(item =>
    (doi && normalize(item.doi || "") === doi) ||
    (title && normalize(item.title) === title)
  );
}

export default function ResearchDiscovery({ projectId, papers, onSavePaper, onOpenLibrary }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Paper[]>([]);
  const [history, setHistory] = useState<ProjectSearchHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searched, setSearched] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const searchSequence = useRef(0);

  useEffect(() => {
    let active = true;
    listProjectSearchHistory(projectId)
      .then(items => { if (active) setHistory(items); })
      .catch(() => { if (active) setHistory([]); });
    return () => { active = false; };
  }, [projectId]);

  const savedCount = papers.length;
  const savedResultCount = useMemo(
    () => results.filter(paper => isSaved(paper, papers)).length,
    [results, papers]
  );

  const runSearch = async (value: string) => {
    const clean = value.trim();
    if (clean.length < 3) {
      setError("Enter at least 3 characters to search academic literature.");
      return;
    }
    const requestId = ++searchSequence.current;
    setQuery(clean);
    setLoading(true);
    setError("");
    setNotice("");
    setSearched(true);
    try {
      const response = await searchPapers(clean, 12);
      if (requestId !== searchSequence.current) return;
      setResults(response.papers || []);
      try {
        await recordProjectSearch({ id: crypto.randomUUID(), projectId, query: clean, searchedAt: Date.now() });
        const savedHistory = await listProjectSearchHistory(projectId);
        if (requestId === searchSequence.current) setHistory(savedHistory);
      } catch {
        setNotice("Search completed. Recent-search history could not be saved in this browser.");
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

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    void runSearch(query);
  };

  const savePaper = async (paper: Paper) => {
    const key = paper.doi || paper.title;
    setSaving(key);
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

    <form className="rd-search" onSubmit={submitSearch}>
      <Search size={19}/>
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Try: childhood immunization timeliness in sub-Saharan Africa" aria-label="Search academic literature"/>
      <button type="submit" disabled={loading || query.trim().length < 3}>{loading ? <LoaderCircle className="rd-spin" size={16}/> : "Search papers"}</button>
    </form>
    <div className="rd-search-hint">Search powered by Semantic Scholar · Use specific topics, populations or interventions for more focused results.</div>

    {history.length > 0 && <div className="rd-history">
      <div className="rd-section-label"><Clock3 size={14}/> RECENT SEARCHES</div>
      <div className="rd-history-list">{history.slice(0, 6).map(item =>
        <button key={item.id} disabled={loading} onClick={() => void runSearch(item.query)}>{item.query}</button>
      )}</div>
    </div>}

    {error && <div className="rd-alert" role="alert">{error}</div>}
    {notice && <div className="rd-notice"><Check size={15}/>{notice}<button onClick={onOpenLibrary}>View library <ArrowUpRight size={13}/></button></div>}

    <div className="rd-results-heading">
      <div><div className="rd-section-label"><FileSearch size={14}/> SEARCH RESULTS</div>
        <h3>{loading ? "Searching academic sources…" : searched ? "Literature matching your search" : "Start with a research question"}</h3>
      </div>
      {searched && !loading && <span>{results.length} results · {savedResultCount} already saved</span>}
    </div>

    {loading ? <div className="rd-loading"><LoaderCircle className="rd-spin" size={22}/><span>Searching Semantic Scholar…</span></div> :
      results.length > 0 ? <div className="rd-results">{results.map((paper, index) => {
        const saved = isSaved(paper, papers);
        const key = paper.doi || paper.title;
        return <article className="rd-paper" key={paper.doi || paper.title + index}>
          <div className="rd-paper-icon"><BookOpen size={17}/></div>
          <div className="rd-paper-main">
            <h4>{paper.title}</h4>
            <div className="rd-paper-meta">{paper.authors?.slice(0, 5).join(", ") || "Authors not provided"}{paper.authors?.length > 5 ? " et al." : ""}{paper.year ? " · " + paper.year : ""}</div>
            {paper.abstract && <p>{paper.abstract}</p>}
            <div className="rd-paper-links">
              {paper.doi && <span>DOI: {paper.doi}</span>}
              {paper.url && <a href={paper.url} target="_blank" rel="noreferrer">View source <ArrowUpRight size={12}/></a>}
            </div>
          </div>
          <div className="rd-paper-action">
            <button className={saved ? "is-saved" : ""} disabled={saved || saving === key} onClick={() => void savePaper(paper)}>
              {saving === key ? <LoaderCircle className="rd-spin" size={14}/> : saved ? <Check size={14}/> : <span>＋</span>}
              {saved ? "In library" : "Save paper"}
            </button>
          </div>
        </article>;
      })}</div> :
      searched && !error ? <div className="rd-empty"><Search size={24}/><strong>No papers found</strong><span>Try broader terms, alternate wording or a different population or intervention.</span></div> :
      !searched ? <div className="rd-empty"><FileSearch size={25}/><strong>Your discovery workspace is ready</strong><span>Search for a topic above. Results can be added to your project without re-entering their details.</span></div> : null
    }

    <div className="rd-library-footer"><div><strong>{savedCount}</strong><span>papers currently in this project library</span></div><button onClick={onOpenLibrary}>Open research library <ArrowUpRight size={14}/></button></div>
    <p className="rd-disclaimer">Search results are metadata retrieved from Semantic Scholar. Abstracts and publication details may be incomplete; verify the original publication before using it as evidence. This search is not an exhaustive systematic-review search.</p>
  </section>;
}
