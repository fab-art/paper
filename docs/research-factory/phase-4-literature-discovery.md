# Research Factory Phase 4 — Literature Discovery

## Objective

Migrate the existing academic literature discovery workflow into the independent Research Factory while retaining the existing search API, project library and local search history.

## Capability parity

- Search academic literature through the existing Semantic Scholar service.
- Validate query length and handle rate limits with a visible retry cooldown.
- Preserve request sequencing so stale searches cannot overwrite newer results.
- Display useful paper metadata and safe external links.
- Save papers into the active project's local research library.
- Detect already-saved papers by normalized DOI or title.
- Persist and display recent project search history.
- Handle search-history persistence failures without losing successful search results.
- Keep the existing manual source-entry flow available.

## Boundaries

- Reuse the existing search API and IndexedDB search-history store.
- Do not create a second paper library or silently merge/deduplicate legacy records.
- Do not move local papers to Supabase.
- Keep all search failures and rate limits explicit; never fabricate search results.
- Keep the legacy production frontend and production Vercel project untouched.

## Verification

- Unit tests for DOI/title matching and safe URL handling.
- Browser tests for search, cooldown, save, duplicate handling, history and error states.
- Responsive, keyboard and WCAG 2.2 A/AA checks.
- Existing repository regression, security, typecheck and build gates.
- Isolated Vercel preview only.
