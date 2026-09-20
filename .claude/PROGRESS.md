# Current state

**Goal:** Media library app — feature work plus the repo-wide audit fixes.
**Branch:** `main` — the only branch. The four old `claude/*` branches were merged into it and
deleted; `main` is the GitHub default and what Vercel deploys.
**Updated:** 2026-09-20 — AP unit lists loaded; **014, 015, 016 awaiting SQL**

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

- [x] **AP unit tracker** — `/tasks/ap`. Courses and their units, ticked off one by one, with
      per-course and overall progress. The tick stores a timestamp, so it doubles as "finished
      on", and re-ticking keeps the original date. All 6 courses and 37 units are seeded from
      the CEDs (supplied by the user). Physics C is two courses sharing a `series`, rendered as
      one group because College Board numbers them 1-7 and 8-13 across one framework.
      Note the revised frameworks: **AP Statistics is 5 units** (not the old 9) and **AP CS A is
      4 units** — do not "correct" these from older material.

- [x] **Study time totals** — `/tasks/stats` shows time worked today / this week / this month /
      all time. Counts every session, cleared bar or not, and adds a session running right now on
      top of the banked `workedSeconds`. Weeks start Monday, matching the calendar's month grid.
      Boundary cases verified against a real Postgres (Monday edge, month edge, live session).

- [x] **Tasks section** — `/tasks` and `/tasks/stats`. A task is one calendar module on one real
      date, materialised from the day plan dealt onto that date (never created by hand). Work it
      with start/stop sessions; clear half the module's hours and it completes, else it fails.
      A completed task pays 1 XP per minute worked to each stat its module trains, and each of
      the 14 stats levels on `floor(5 * ln(1 + xp/120))`. More failures than completions in a day
      and the day is *extinguished*. Stats are picked per module in the calendar's module editor.
      Verified against a real Postgres: materialisation is idempotent, sessions clamp to the
      module's hours, and a task can never pay XP twice.

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
      The dry run came back clean — 16 rows, all the safe "Season N" pattern, no false
      positives — so `011` backfills them. Two findings from the real data: titles use a
      **`Show | Season N`** separator, which the prefill now reproduces; and
      "Supernatural | Season 4 " carried a **trailing space** that defeated the anchored match
      and hid it among its seven siblings, so `011` trims before matching. Titles are **not**
      stripped: that format is the user's, and the season number is stored alongside it.

- [x] **Calendar section** — day plans dealt onto real dates. A day plan is a timetable of
      activities; each date derives its own kind (weekend always holiday, term weekday school,
      everything else holiday) and the app deals plans of the matching kind onto it. Dealing is
      a shuffled deck per kind, so every plan is used before any repeats; "fill" never touches a
      date you set by hand, "re-deal" replaces the month after confirming. Migration `012`,
      which also enables RLS on all five new tables — every other public table has it, and
      without it these would be the only ones open to the Supabase anon key.
      Two pure modules with 49 assertions (`npm run test`): `lib/calendar-dates.ts` (date-only,
      UTC accessors only) and `lib/calendar-shuffle.ts` (the deal, injectable RNG).
      **"Today" resolves in Europe/Istanbul, not the server's zone** — the deploy region is
      UTC+9 and the user is UTC+3, so a bare `new Date()` opens the wrong month for six hours a
      day. `app/finances/page.tsx` and the subscription cancel route still have that bug.
      **Days can be duplicated** — `POST /api/calendar/days/[id]/copy` clones a plan with its
      whole timetable and opens the copy for editing. Names are unique per kind, so it walks
      "(copy)", "(copy 2)"… to a free one, and strips an existing suffix first so copying a copy
      gives "(copy 3)" rather than "(copy 2) (copy)". A copy is never dealt onto a date.

- [x] **Events became reusable modules.** An `EventModule` is a name plus its hours
      ("Sat vocab study 00:00–01:00"); days are built by placing modules, and editing a module
      updates every day it is in. Migration `013` converts every existing `DayActivity`,
      **merging identical ones into one shared module** — 8 activities across 3 days became 5
      modules with each day keeping exactly the events it had.
      `DayActivity` is deliberately NOT dropped: it is the only surviving copy of the
      pre-conversion timetables and makes the change reversible. A later migration removes it,
      and per the direction rule that one runs *after* the deploy that stops reading it.

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

- **Run `prisma/manual-migrations/015-ap-courses.sql` then `016-ap-units.sql`** — 015 creates
  `ApCourse`/`ApUnit` (additive, RLS on); 016 loads the 6 courses and 37 units. 016 is an upsert
  that refreshes titles and weightings but never writes `completedAt`, so re-running it applies a
  CED correction without un-ticking finished units — verified. Both go in the same sitting as 014.

- **Four unit weightings are missing** (`weighting IS NULL`), because the pasted lists cut off
  before them: Stats Unit 5 Regression Analysis, Physics C Mech Unit 7 Oscillations, World
  History Unit 9 Globalization, Macro Unit 6 Open Economy. The tracker just shows no percentage.
  To fill them in, edit 016 and re-run it.

- collegeboard.org is blocked by this environment's egress proxy (apcentral and apstudents both;
  `recentRelayFailures` empty, so it is policy). Any future CED data has to come from the user —
  WebSearch summaries of those pages contradicted each other on unit counts.

- **Run `prisma/manual-migrations/014-task-stats.sql`** — adds `stats` to `EventModule` and
  rebuilds `Task` against the calendar. Additive for the calendar; it *drops* the old standalone
  `Module` table and the first-cut task tables (they only referenced the duplicate module system,
  so nothing real is lost). The rebuild is guarded on the old shape, so a second run leaves real
  task history alone — proven by running it twice with a completed task and 180 XP in place.
  Enables RLS on the three tables it creates. Run it **before** deploying.
  Supersedes the earlier `prisma/tasks-tables.sql`, which is deleted: it created the duplicate
  tables *without* RLS.

- **Run `prisma/manual-migrations/012-calendar.sql`, then `013-event-modules.sql`** — both
  additive, so both go in **before** the deploy. 012 creates the Calendar tables; 013 adds
  event modules and converts existing activities into them. Both enable RLS on what they create
  and are safe to re-run.
- **Run `prisma/manual-migrations/008-drop-series-name.sql`** — but only *after* the deploy
  carrying this commit is live, since it is a removal (see the run-order note in that file).
  Nothing breaks if it is never run: the columns just sit there unused. It is safe to re-run.
- Migrations `001`–`007`, `009` and `011` and the RLS block are **all applied**. `010` was a
  read-only dry run, not a migration. Only `008` is outstanding, and it is optional.
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
