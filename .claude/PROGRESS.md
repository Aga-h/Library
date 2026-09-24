# Current state

**Goal:** Media library app — feature work plus the repo-wide audit fixes.
**Branch:** `main` — the only branch. The four old `claude/*` branches were merged into it and
deleted; `main` is the GitHub default and what Vercel deploys.
**Updated:** 2026-09-24 — daily review + 23:15 routine; **018, 019 and the review setup await the user**

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

- [x] **Study section — SAT vocabulary** (`/study/sat-vocab`). One multiple-choice question per
      *meaning*, so a word with three senses is asked three times. Answer right and file it as
      Done or Ambiguous; answer wrong and it goes to To Review automatically and cannot be
      reclassified. A run is the **whole list** by default — all 1,068 questions — with 25 / 50 /
      100 / 250 on offer next to the button for a shorter sitting. Distractors are always drawn
      from the whole vocabulary, so a short run is not four options deep. The three lists show word + meaning and persist until "Take the test again",
      which builds and reshuffles a fresh run. The word list is pasted in at
      `/study/sat-vocab/words` — no migration needed to change it, and re-importing a word
      replaces its meanings rather than duplicating. **The rules that make the test honest:**
      a distractor is never another sense of the same word (that would be a second correct
      answer) and never reads the same as the answer (different words share definitions —
      amiable and amicable are both "friendly"); at most one option per word. Verified on real
      generated runs, not just in unit tests.

- [x] **XP curve retuned** — `k` 5 → 10, with the scale tied to `30k` so level 1 stays at about
      half an hour. Each level now costs +10.5% instead of +22%, and a doubling of hours buys
      ~7 levels instead of 3.5. Level 30 moved from 805h to 95h; the old level-30 wall now sits
      at level 50. No migration: XP is stored, level is derived, so every stat re-mapped on
      deploy and the numbers jumped up once. `scripts/test-leveling.mjs` pins the properties
      (round-trips, monotonicity, levels-per-doubling, the hour targets) — 17,292 assertions.

- [x] **`middleware.ts` → `proxy.ts`** — the Next 16 rename, which also moves it from the Edge
      runtime to Node.js. Auth re-verified end to end against a production build: unauthenticated
      pages redirect, `/api/*` gets 401 JSON, the PWA install assets stay public, `/loginsomething`
      is still not treated as public, and a tampered, garbage, empty or raw-AUTH_SECRET cookie is
      rejected — so the HMAC is genuinely verified under the new runtime. Cookie keeps
      Secure/HttpOnly/SameSite=lax.

- [x] **Knowledge graph removed** — `graphify-out/` (3.5 MB, 21 files) was a snapshot built at
      `0e13734`, four features out of date, and AGENTS.md told every session to trust it first.
      Deleted along with `scripts/seal-graph-html.mjs`, the `graph:seal` script and the
      `vis-network` dependency that existed only to seal it.

- [x] **Docs refresh** — README was still create-next-app boilerplate; CODEBASE.md was a 41 KB
      "complete reference" that predated Finances, Calendar, Tasks and APs and still documented
      the **pre-audit auth** (session cookie = AUTH_SECRET), which the security work deliberately
      removed. Both rewritten, every claim checked against the code. Migrations README table now
      covers 001-017 in order. Deleted 4.4 MB of Vercel request-log CSVs and gitignored the
      pattern.





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


- [x] **Events became reusable modules.** An `EventModule` is a name plus its hours
      ("Sat vocab study 00:00–01:00"); days are built by placing modules, and editing a module
      updates every day it is in. Migration `013` converts every existing `DayActivity`,
      **merging identical ones into one shared module** — 8 activities across 3 days became 5
      modules with each day keeping exactly the events it had.
      `DayActivity` is deliberately NOT dropped: it is the only surviving copy of the
      pre-conversion timetables and makes the change reversible. A later migration removes it,
      and per the direction rule that one runs *after* the deploy that stops reading it.

- [x] **Calendar and tasks removed.** Days, day plans, dealing, school terms, days off and
      calendar-driven tasks are gone, along with the 50%-of-the-hours bar and extinguished days.
      Modules survive without hours: a module is a title plus the 1–3 stats it trains. You study
      by starting a session and picking one; stopping pays one XP per whole minute to each of its
      stats. No module rolls three at random, for one-off things. `/tasks` and `/calendar` were
      folded into one **Study** section — sessions, modules, stats, APs and SAT vocabulary — so
      the portal is four cards and "study" means one thing. Migration `019` converts every worked
      task into a study session: **no XP and no study time was lost**, proven by before/after
      totals on a seeded copy of the old schema.

- [x] **Daily review** — `/study/review` (any date, prev/next) and the same as JSON at
      `GET /api/study/review`: time per module, XP and level-ups, streak, AP units ticked, SAT
      questions answered with the words that went to To Review. Day boundaries go through
      `todayKey`, so 00:30 in Istanbul counts for that day, not the previous UTC one — proven by
      a mutation test that swaps in UTC and fails. The endpoint also accepts
      `Authorization: Bearer <REPORT_TOKEN>` for exactly that path and GET only; unset or under
      32 chars it fails closed (verified end to end, including the literal string "undefined").
- [x] **Nightly review routine** `trig_01CmCeMSpvvCU2xYoyRyNjQy` — `15 20 * * *` UTC = 23:15
      Istanbul (UTC+3 year-round, no DST). Fresh session per night, push notification on. It
      curls the JSON and writes the report; if setup is missing it says exactly what, and never
      invents numbers. No connectors — it needs none. Environment `env_01ChuErCg6LBHyTA3T7HcGXZ`.

- [x] **MyPortal Handbook** (Claude Doc, the user's reference) —
      https://claude.ai/code/artifact/a0b04b43-3225-436e-9296-1072eeff057d — rewritten 2026-09-24
      for the current app: Calendar/Tasks/Working a task/Free study sections removed; new Study,
      SAT vocabulary and Daily review sections; Stats, At a glance and environment table corrected
      (it listed `NEXT_PUBLIC_APP_TIMEZONE`, which no code reads — the zone is fixed in
      `lib/dates.ts`). **Update it whenever a section's behaviour changes.**

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

- **Set up the nightly review** (the routine fires regardless and reports what is missing):
  1. Vercel → project → Settings → Environment Variables: `REPORT_TOKEN` = 32+ random chars,
     then **redeploy** (env changes only reach new deployments).
  2. This Claude cloud environment → Edit → environment variables: the same `REPORT_TOKEN`, and
     `PORTAL_URL` = the site's address, no trailing slash.
  3. Same settings → Network access: add the site's host to the allowed domains. The current
     policy denies `*.vercel.app` (proxy 403, verified) — without this the routine cannot reach
     the site at all.

- **Set the GitHub repo description.** There is no tool for it here; it is Settings → General.
  Suggested: "Personal hub — media library, wardrobe, finances, calendar and a task tracker that
  levels stats. Next.js, Prisma, Supabase."

- **Provide the production URL.** It is recorded nowhere in the repo, so the deploy of the
  hierarchy work has never been checked in the browser — only proven correct locally. It is
  also needed to give exact PWA install instructions.

- **Run `prisma/manual-migrations/019-drop-calendar.sql`** after 018 — removes the calendar and
  rebuilds study around modules. It is destructive (day plans, terms, days off and task rows are
  deleted for good) but carries every worked task across as a study session, so XP, levels and
  study-time totals come out unchanged. Verified against a seeded copy of the old schema: 315 XP
  and 9,300 seconds identical before and after, `migrate diff` empty, second run a no-op.
  **/study errors until it runs**, because the new code needs the new shape.

- **Run `prisma/manual-migrations/018-sat-vocab.sql`** — creates `VocabWord`, `VocabMeaning`,
  `VocabRun`, `VocabQuestion` and the `VocabVerdict` enum. Additive, RLS on, safe to re-run.
  `/study/sat-vocab` errors until it runs. No seed data: the word list is imported through the UI.

- **Load the word list** at `/study/sat-vocab/words` once 018 is applied — one button,
  "Load the built-in SAT list (991 words)". The list lives in the repo at `lib/sat-vocab-list.ts`,
  so correcting a definition is an edit there plus pressing the button again; pasting a custom
  list still works alongside it.

- **Run `prisma/manual-migrations/015-ap-courses.sql` then `016-ap-units.sql`** — 015 creates
  `ApCourse`/`ApUnit` (additive, RLS on); 016 loads the 6 courses and 37 units. 016 is an upsert
  that refreshes titles and weightings but never writes `completedAt`, so re-running it applies a
  CED correction without un-ticking finished units — verified. 016 depends on 015, so run in order.

- **Four unit weightings are missing** (`weighting IS NULL`), because the pasted lists cut off
  before them: Stats Unit 5 Regression Analysis, Physics C Mech Unit 7 Oscillations, World
  History Unit 9 Globalization, Macro Unit 6 Open Economy. The tracker just shows no percentage.
  To fill them in, edit 016 and re-run it.

- collegeboard.org is blocked by this environment's egress proxy (apcentral and apstudents both;
  `recentRelayFailures` empty, so it is policy). Any future CED data has to come from the user —
  WebSearch summaries of those pages contradicted each other on unit counts.

- Migrations `014-task-stats.sql` and `017-free-study.sql` are **applied** (user confirmed).
  014 added `stats` to `EventModule` and rebuilt `Task` against the calendar; 017 added
  `StudySession` and the `XpAward` columns for free study.

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

- **Real data found two defects that 68 unit assertions did not.** The 991-word list contains six
  pairs of different words sharing one definition verbatim, which the builder happily offered as
  each other's distractors — 51 of 240 questions broken on that data. And a per-word import loop
  was 991 round trips, fine against localhost and a timeout against Supabase. Run new code over
  the actual corpus before believing it.

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
