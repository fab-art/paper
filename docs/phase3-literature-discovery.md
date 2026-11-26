# Phase 3 — Literature Discovery

## Goal
Migrate the existing Semantic Scholar discovery capability into the independent Research Factory frontend while retaining the original API boundary, cache, cooldown behavior and local-first project model.

## User workflow
1. Open Literature Discovery from the Research Factory navigation.
2. Search Semantic Scholar with a 3–500 character query. The provider request is capped at 20 records.
3. Inspect author, year, abstract, venue, citation count, publication date, DOI, source URL and open-access PDF metadata where supplied.
4. Filter by open-access availability and publication-year range; sort by relevance (provider order), citation count or newest year.
5. Select a local project and save relevant papers into its existing literature library.
6. Export the project's current BibTeX bibliography.
7. Re-run a recent project search from the local search-history list.

## Architecture and data ownership
- The existing Vercel Function \`/api/search-papers\` remains the only Semantic Scholar network boundary. The browser does not call the provider directly and never receives the optional API key.
- Existing request validation (3–500 characters, limit 1–20), ten-minute bounded LRU cache, provider cooldown and Retry-After handling are retained.
- Search history uses the existing Dexie \`searches\` table and existing per-project history cap; it does not add a database or schema migration.
- Saved records remain on the user's device in the existing \`Project.papers\` and \`Project.bibtex\` fields.
- Saving uses the existing project adapter and revision/tombstone safeguards. No project is uploaded to Supabase and no collaboration behavior changes.
- The project selection is optional for discovery. Saving and project-specific history require an active local project.

## Metadata, deduplication and citation rules
- DOI normalization handles DOI URLs, \`doi:\` prefixes, case and trailing punctuation.
- Title normalization uses Unicode NFKC and Unicode letters/numbers, so non-Latin titles are not discarded.
- A paper is treated as the same record when normalized DOI matches or normalized title matches.
- Duplicate results are collapsed while missing metadata and additional author names are retained; existing owner-entered source labels take precedence.
- External links are accepted only when their URL protocol is HTTP or HTTPS.
- BibTeX entries contain only supplied metadata. Missing fields are omitted; no author, venue, year, DOI or publication details are invented.
- Existing BibTeX title/DOI entries are checked before appending references.

## Research integrity and provider failures
- Results are explicitly attributed to Semantic Scholar and labelled as discovery leads, not quality assessments.
- Users are instructed to verify bibliographic details against publisher records before citing.
- Provider 429 responses preserve the API's retry-after feedback; the interface does not retry automatically or claim that a cooldown has elapsed.
- API errors are surfaced to the user. Empty results, no-filter-match, loading, save, and local-library failure states are distinct.
- Open-access availability is displayed only when the provider supplied an open-access PDF URL.

## Verification
- Unit tests cover DOI normalization, Unicode title normalization, DOI/title identity, metadata merging, author deduplication, HTTP(S)-only links and BibTeX generation/append behavior.
- Existing project and API cache/cooldown tests remain part of the full regression suite.
- TypeScript strict checking and Vite production build are required on the exact Phase 3 commit.
- Preview browser walkthrough should verify search, filtering, project save, duplicate save, history reload and BibTeX export.
- This phase does not certify evidence quality or full-text availability.

## Not included in this slice
- Crossref/OpenAlex/PubMed providers or federated multi-database search.
- Automated citation-quality ranking or AI eligibility decisions.
- Full-text PDF ingestion, extraction or automatic screening.
- Bulk RIS/EndNote import/export or a formal systematic-review search strategy builder.
- Cloud synchronization of local project libraries.
