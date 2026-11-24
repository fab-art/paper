# Project Workspace UI checklist

Sized as a whole-page UI phase: the Project Workspace shell and its seven workspace sections are being improved together; feature logic and data contracts remain protected.

Reference: the existing Project Workspace is the named reference for its information architecture and behavior. Keep the seven section roles and their order: Overview, Research library, Notes, Discover, Systematic review, Data & Methods, Quality & Export.

- Theme: light academic; page background `#f5f5f7`, white surfaces, text `#1d1d1f`, muted text `#777982`, single muted violet accent `#625f98`, border `#e5e5ea`.
- Typography: system sans stack; page title 25-36px semibold with tight tracking; section headings 14-18px semibold; body 11-12px with readable line-height; compact metadata 9-10px.
- Layout: centered content max-width 1240px; main horizontal padding `clamp(16px, 4vw, 48px)`; sticky 62px topbar; section navigation remains horizontally scrollable on narrow screens.
- Surfaces: panels use white backgrounds, 1px neutral borders, 13px radius, subtle low-contrast shadow; inner controls use 9px radius; avoid heavy elevation and decorative gradients.
- Accent and status: violet is the only action accent; success/error states retain explicit text and icon semantics, never color alone.
- Controls: preserve existing control labels, names, order, and action meanings; maintain visible focus rings, keyboard access, adequate target sizes, and clear disabled/selected states.
- Responsive behavior: preserve the 320px minimum viewport; collapse overview and notes columns to one column by 800px; stack header, title/status, and library actions by 560px; avoid horizontal page overflow.
- States: retain loading, missing-project, empty library/notes, save notice, conflict recovery, and upload feedback; make feedback visually consistent and announced with existing status/alert semantics.
- Data and workflows: preserve IndexedDB/local-first persistence, autosave queue and conflict guard, source deduplication, attachment limits/download/delete, notes CRUD, milestones, and navigation to Writing Studio.
- Not copied: do not change the seven-section information architecture, child research tools' internal workflows, local-first storage, or the Writing Studio's separate dark focused theme.
