# Current state

**Goal:** Media library app — feature work plus the repo-wide audit fixes.
**Branch:** claude/repository-overview-FcVyQ (deploy) — hierarchy-phase-1 merged, done with
**Updated:** 2026-08-19 — season selector built; 008 and 009 awaiting SQL

## Done

- [x] Finances section — budget, expenses (10 categories), additional income, carryover, TRY currency
- [x] Recurring subscriptions — per-issue billing, cancel-from-next-month
- [x] Comics restructured into Publisher → Universe → Title → Issue (real FKs, cascade deletes)
- [x] Per-issue reread tracking; reading time counts every pass, not every issue
- [x] Audit Phase 1 — security: Next 16.2.3 → 16.3.1 (6 middleware-bypass advisories),
      upload path-traversal closed, image `remotePatterns` narrowed, signed HMAC session token,
      401 JSON for `/api/*`, logout, login rate limit, open-redirect fix
- [x] Audit Phase 2 — correctness: dead "Time Remaining" stat, edit forms can clear fields,
      filter params validated (400 not 500)
- [x] Audit Phase 3 — performance: cover-mosaic preload storm removed, list-page over-fetching,
      17 components off the client bundle, steam-sync N+1 batched, index gaps
- [x] Audit Phase 4 — robustness: `withErrors` on route handlers, db connection guard,
      finance caching made real
- [x] Audit Phase 5/6 — shared form helpers, label `htmlFor`, ESLint + lint/typecheck scripts
- [x] Verified idempotent SQL migration at `prisma/manual-migrations/001-…sql`
- [x] RLS enabled on all public tables (closes the Supabase REST API to the anon key)
- [x] Cross-session resume — `.claude/PROGRESS.md` + SessionStart hook
- [x] **Mobile expense logger (PWA)** — `/finances/log`, installable to the iOS home screen,
      offline queue in IndexedDB, idempotent sync. Verified end-to-end against a real
      Postgres + Chromium: 10/10 browser checks, and duplicate-free in the database.

- [x] **Auto-derived status** for Books/TV/Anime/Manga — computed from progress counts on every
      write, status dropdown removed, Dropped/On Hold/DNF deleted. Books gained `pagesRead`,
      manga gained a *still releasing* flag. 127 unit assertions + 11 database-level API checks.

- [x] **Phase 1 of the hierarchy work** — shared `ui/` components (Breadcrumb, EntityCard,
      LevelStats, DeleteEntityButton, HierarchyForm) extracted from comics; comic publishers,
      universes and titles lost their images; TV gained Universe → Series → Season with the
      `seriesName` backfill; Seasons Watched replaced by Episodes Watched. **Shipped.**

- [x] **Phase 2 of the hierarchy work** — anime gained Universe → Series → Season, mirroring TV:
      `AnimeUniverse` + extended `AnimeSeries` + `Anime.seriesId` (all `SET NULL`), four API
      routes, seven pages under `u/` and `s/`, and the main page rebuilt as three buckets
      (universes / series with no universe / seasons with no series). A filter or search still
      sweeps the whole library so nothing inside a series becomes unfindable.
      Also fixed along the way, both of which were live bugs from Phase 1:
      **`?seriesId=` was ignored** — "Add Season" from a series page created an unattached
      season, because neither form had a series field. Both forms now have one
      (`components/ui/SeriesSelect.tsx`), prefilled from the query string, so a season can also
      be moved between series from its edit page.
      **Detail pages had no way back up** — TV and anime seasons now carry a breadcrumb showing
      Universe › Series › Title, with each level linked.
      **Shipped.**

- [x] **Phase 3 of the hierarchy work** — books gained Universe → Series → Book plus standalone,
      same shape as anime. Migration `006` has no backfill: books never had a `seriesName`, so
      every existing book stays standalone until filed by hand. The book form gained the shared
      series picker, and the detail page a Universe › Series › Title breadcrumb.
      Also removed the dead `/api/tv-series` route, twin of the `anime-series` one deleted in
      Phase 2. **Shipped.**

- [x] **Phase 4 of the hierarchy work** — movies gained Universe → Movie. Two levels, not
      three: a franchise *is* the universe, so films sit directly inside it and the main page
      has two buckets rather than three. Migration `007`, no backfill. Films inside a universe
      list in release-year order, since that is how a franchise is watched.
      The shared picker was generalised from `SeriesSelect` to `HierarchySelect` (and
      `lib/series-options.ts` to `lib/hierarchy-options.ts`) so movies can pick a universe
      with the same control the other three use for a series.
      **Shipped.**

- [x] **Attach an existing entry to its parent.** You could only ever *create* a new series
      inside a universe, never file one you already had, and the series edit form had no
      universe field at all. **No migration** — every route already accepted its parent key on
      PATCH with 404/409 guards; nothing sent it. Added `components/ui/AttachExistingButton.tsx`
      on the three universe pages, the three series pages and the movie universe page, plus a
      Universe field on `HierarchyForm` for the three series edit and new pages. Three real
      bugs fixed on the way: the 409 rendered `A series named "undefined" already exists here`
      whenever the request carried no name (which is every move); the four leaf forms never
      called `router.refresh()`, so a series you moved something *out of* still listed it; and
      standalone entries sorted last in every picker, because Postgres puts NULLs last and
      Prisma cannot override that on a relation `orderBy`.

- [x] **Migrations 002–007 confirmed applied, and the hierarchy work deployed.** Confirmed by a
      read-only preflight query rather than assumed: 14 table/column checks plus the four status
      enums, all clean. Locally the four scripts were replayed in order onto the pre-deploy
      schema and `prisma migrate diff` came back empty, proving the chain produces exactly the
      schema the code expects. Merged fast-forward into `claude/repository-overview-FcVyQ`
      (`67e4641..e3cef41`) — no divergence, no conflicts.

- [x] **Migration `008` — the dead `seriesName` columns dropped.** The user confirmed the
      backfilled TV and anime series look right. `seriesName` is out of `schema.prisma` and the
      four TV/anime API routes, and `008-drop-series-name.sql` drops both columns behind a guard
      that aborts if any row still has a name but no `seriesId`. **This is the first migration
      whose run order is reversed** — a removal has to follow the code that stopped using the
      column, because Prisma names every column explicitly in its SELECTs. Verified by running
      one build of the new code against the same database before *and* after the drop: pages,
      creates and edits all fine in both states.

- [x] **Knowledge graph committed at `graphify-out/`.** graphify maps the repo to 1398 nodes /
      2620 edges / 154 labelled communities. Tracked deliberately so it survives a container
      wipe — the standing rule is in `AGENTS.md`: query the graph before reading the tree, but
      never for code changed this session, and never in place of verifying against a real
      Postgres. `npm run graph:seal` inlines vis-network into `graph.html` (SRI-verified)
      because graphify emits an unpkg `<script src>` that is dead offline and inside the
      artifact viewer. Run it after every `/graphify .`.

- [x] **Season is picked, not typed into the title.** `TvShow.seasonNumber` / `Anime.seasonNumber`
      (migration `009`, additive). Opening "Add Season" from a series preselects the next unused
      number and prefills the title as "{Series} Season {n}" — nothing to type — but a title the
      user writes themselves is never overwritten, guarded by a `titleDirty` flag that means
      "the user typed this", not "a title exists". Seasons inside a series now order by number
      (nulls last) instead of by insertion. Season badge on cards and detail pages.
      `Anime.season` is the AIRING enum and untouched; its form label became **"Aired"** so two
      controls are never both called "Season". Added `NumberSelectField` to `components/ui/form.tsx`
      rather than making the season a seventh copy of the `timesRewatched` select.
      **`010` is a read-only dry run** for parsing seasons out of existing titles — it must be
      reviewed before a backfill is written, because "Stranger Things 4" and "Steins;Gate 0" are
      indistinguishable from real suffixes by shape.

## Next

Three items were scoped in the audit but not implemented. In rough value order:

- [ ] **Trigram search indexes.** Every list page searches with `contains` → `ILIKE '%q%'`,
      which no btree can serve, so each search is a full sequential scan. Needs
      `CREATE EXTENSION pg_trgm` plus a GIN index per searched column. Requires a SQL script
      in `prisma/manual-migrations/` since `db push` can't reach this database.
- [ ] **`next/image` on the 8 remaining detail pages** (`app/library/*/[id]/page.tsx` and
      `app/wardrobe/[id]/page.tsx`). These are the largest images on the site and the only ones
      still unoptimised — no resizing, no AVIF/WebP, no lazy loading, CLS on every load.
      The card components were migrated already; copy that pattern.
- [ ] **`aria-label`s on icon-only controls.** Only 3 exist. lucide auto-applies
      `aria-hidden` to childless icons, so an icon-only button/link has an empty accessible
      name. Sweep `components/` for buttons and links whose only child is an icon.

## Blocked / needs the user

- **Provide the production URL.** It is recorded nowhere in the repo, so the deploy of the
  hierarchy work has never been checked in the browser — only proven correct locally. It is
  also needed to give exact PWA install instructions.
- **Run `prisma/manual-migrations/009-season-number.sql`** — additive, so it goes in **before**
  the deploy carrying the season selector. Safe to re-run.
- **Then run `010-dry-run-season-from-title.sql`** — read-only, changes nothing. Send back its
  output and the backfill (`011`) gets written against rows you have actually eyeballed.
- **Run `prisma/manual-migrations/008-drop-series-name.sql`** — but only *after* the deploy
  carrying this commit is live, since it is a removal (see the run-order note in that file).
  Nothing breaks if it is never run: the columns just sit there unused. It is safe to re-run.
- Migrations `001`–`007` and the RLS block are **all applied and confirmed**.
- Any *future* schema change needs the same treatment: `prisma db push` cannot reach this
  Supabase instance (no credentials here, and port 5432 is blocked), so write an idempotent
  script into `prisma/manual-migrations/` and ask the user to paste it into the Supabase SQL
  Editor. **Do not assume it has been run — confirm it**, and confirm with a query rather than
  a yes/no. The preflight pattern that worked: a `VALUES` list of expected (table, column)
  pairs left-joined against `information_schema.columns`, reporting `ok` / `*** MISSING ***`
  per migration, plus a `pg_enum` roll-up for enum changes. Test it against a throwaway
  Postgres *and* prove it can fail before handing it over.

## Notes for the next session

- The expense logger's duplicate bug was only visible by checking the **database**, not the UI —
  the browser tests all passed while Postgres held 4 rows for 3 expenses. Assert against the data
  store, not just the screen.
- A client-side lock cannot prevent duplicate submissions across page contexts (two tabs, or a
  navigation racing the `online` event). Idempotency has to be enforced server-side.

- **The container is wiped between sessions.** `node_modules/` will be gone; the session-start
  hook reinstalls it. Anything not committed is lost.
- `npm run build` is the real gate — `tsc --noEmit` alone misses Next-specific failures like a
  client component importing something that pulls in `lib/db` (and therefore `pg`).
- 3 npm advisories remain, all in the Prisma **CLI** (`@prisma/config` → `deepmerge-ts`).
  Fixing needs `--force`. `prisma` is a devDependency, so none of it reaches production.
- The user often works from an iPad — prefer pasting SQL and commands directly into chat over
  linking to repo paths they'd have to go open.
