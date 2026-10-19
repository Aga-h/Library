# Current state

**Goal:** Media library app — feature work plus the repo-wide audit fixes.
**Branch:** `main` — the only branch. Leftover `claude/phone-wip`, `claude/anime-list-import-alt`, and `cursor/phone-interface-a49b` were merged or deleted; `main` is the GitHub default and what Vercel deploys.
**Updated:** 2026-10-19 — books: Mistborn shows as "Mistborn: The Final Empire" (subtitle was dropped, and langRestrict hid untagged English books). On `main`. Remaining: Early Cyber then Cyberdelia redesigns; trigram search indexes; `next/image` on 8 detail pages; `aria-label`s on icon-only controls. Migrations 029–037, `MAL_CLIENT_ID`, and `GOOGLE_BOOKS_API_KEY` still need the user.

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
      `lib/dates.ts`). 2026-10-02 (rev 28): TMDB movie import paragraphs under Library, and
      `COMICVINE_API_KEY` / `TMDB_API_KEY` rows in the environment table. Rev 30: TV import, episode buttons and time-watched paragraphs. Rev 31: anime import paragraphs and the `MAL_CLIENT_ID` row. Rev 32: "Look" paragraph + table of the five themes under At a glance.
      **Update it whenever a section's behaviour changes.**

- [x] **Weekly study goals** — an overall target in hours and one per module, all set inline in
      the Study page's This week box: every studyable module has its own row there, with "Set goal"
      when it has none (also editable on the Modules page). Progress bars on the Study page, a "2h / 5h this
      week" line on each module card, and a Weekly goals block in the daily review and the 23:15
      report. Per-day need counts today and rounds up, so it never under-asks — a property test
      checks that over every day of a week. Verified over HTTP against Postgres: every bad input
      refused (0, negative, over 168h, a sliver, a string), clearing works, and progress matched
      SQL including a running session.

- [x] **Comics: writer, artist and release date removed** — from the forms, the pages, the API and
      the schema (`ComicTitle.author`/`artist`, `ComicIssue.releaseDate`). All three were nullable,
      so the new code runs fine against a database that still has them: verified that every comics
      page renders with none of the old values leaking, and a stale client still sending them is
      accepted with the fields ignored.

## Next

- [x] **Books: Mistborn: The Final Empire missing** (asked 2026-10-19). Google stores the
      title as "Mistborn" and the subtitle as "The Final Empire", so search showed "Mistborn"
      and folded it into other Mistborn books. Subtitle is now part of the title. `langRestrict=en`
      is not sent: it drops books Google tagged `un` and can return nothing. A tagged translation
      is still left out. Search is the first 80 volumes that have a page count. On `main`.
- [x] **Working rules** (asked 2026-10-19). How to change this repo — read first, match the
      surrounding code, keep the diff to the task, verify, and say what was not checked — is
      in `AGENTS.md` under "How to work", so later sessions load it. On `main`.
- [x] **Books: English titles** (asked 2026-10-19: Mistborn came back as "O Império Final").
      Title search asks Google Books for English only, and a tagged translation is dropped
      even when it has more pages. An ISBN still opens that exact edition. On `main`.
- [x] **Books: physical copy and Kindle** (asked 2026-10-19). Add Book can tick “A physical
      copy” and “It on Kindle” before import; new rows save both. The book form has the same
      two boxes. `owned` stays the physical copy; `ownedKindle` is new (037, default false).
      Re-import does not change either. On `main`.
- [x] **Books: paperback page count on every search hit** (asked 2026-10-19, after Vol. 1
      was fixed). The blank-count refetch only covered the closest few titles, so the rest
      of a search still showed Kindle pages. Every paperback the list reports as 0 pages is
      fetched with `volumes.get`. A physical copy wins over a longer Kindle file. On `main`.
- [x] **Books: Google Books only** (asked 2026-10-19: drop Open Library). Add Book searches
      Google Books `/volumes` only; import and "Check Google Books" never call Open Library.
      Hits without a page count are still omitted. Existing `openLibraryId` rows stay and
      match by title+author so a Google Books import does not duplicate them. Search needs
      `GOOGLE_BOOKS_API_KEY` (no OL fallback). Tests: OL matching 92, Google Books 71. On `main`.
- [x] **Books: hide hits with no page count** (asked 2026-10-19: cannot add them to the library).
      Combined search omits a work unless Open Library or Google Books has pages; a page count
      from the other catalogue still shows the row. Add Book no longer lists “No page count”.
      On `main`.
- [x] **Books: search title follows the query's language** (asked 2026-10-19: Mushoku Tensei
      English title came back in Chinese/Japanese). Open Library's work title is 無職転生;
      English lives on the edition. Prefer the edition/Google Books title in the same script
      as the query, list those first, import that title. On `main`.
- [x] **Books: Google Books + no auto-tick** (asked 2026-10-18: Open Library missed a title;
      search ticked every match). Search Open Library and Google Books together; merge by
      title+author; GB-only hits still show (lifted first when they match the query). Results
      start unticked — All/None stay explicit. `Book.googleBooksId` unique (036).
      `GOOGLE_BOOKS_API_KEY` optional: without it GB may 403/429 and search still returns Open
      Library, with a notice. Publisher filled from GB when blank. Importable if either source
      has a page count; search only lists those. Tests: OL 105, GB + combined search 92. On `main`.
      **Needs 036 + the API key** (see Blocked). No browser e2e here (no Postgres).
- [x] **Books from Open Library** (asked 2026-10-18: auto-import like the other library sections).
      Open Library Search API — no key. A work is one book (`Book.openLibraryId` unique, 035).
      "Add Book" searches a title, an author, an ISBN or a work id; tick several (Harry Potter
      lists the seven novels first) into a series you pick, or standalone. Author, page-count
      median, cover; publisher skipped (edition soup); language is yours. Hand-added linked by
      title+author; re-import fills blanks only; "Find / Check Open Library" on the book page.
      Goodreads has no public API.
      **Needs 035 run** (see Blocked). No env var. On `main`.
- [x] **Comics: import a whole run from Comic Vine** — "Add Comic" searches Comic Vine; Import
      creates the comic and every issue (names + covers); "Check for new issues" on an imported comic
      picks up new releases. Read/Owned buttons were already on every issue row. Verified against a
      local stand-in speaking Comic Vine's documented API, over real HTTP and Postgres: a 446-issue
      run in 5 pages; importing over a hand-added comic kept read/owned/rating/your own name and only
      filled blanks; re-import added nothing; a new release was picked up; a double tap made one
      comic; ½/-1/1.1 placed in order, 1.MU and a 1.1/1.10 collision reported; placeholder covers
      refused; missing key → 503 with a plain message, wrong key → plain message, rate limit → 429.
      **Confirmed working on the live site with real Comic Vine data by the user (2026-10-01)**,
      covers included — so `pickImage` finds the real image fields.
      marvelreading.com is out for good: Cloudflare challenge on every non-browser request, and
      robots.txt disallows ClaudeBot.
- [x] **Movies: auto-log from TMDB** (asked 2026-10-02). IMDb ruled out — its Conditions of Use forbid
      "robots, screen scraping, or similar data gathering" without written consent, and it has no public
      API; TMDB gives each film's IMDb id, so the detail page links to IMDb. "Add Movie" (from a universe
      it aims at that universe) searches films, collections and keyword tags; a collection/tag opens a
      preview with checkboxes in release order → import up to 100 with director(s), studio, runtime,
      year, language, poster. Re-import only fills blanks; standalone films move in; films in another
      universe stay and are reported. One-tap Watched toggle on every card. TMDB notice + logo shown.
      Verified against a local stand-in speaking TMDB's documented API, over real HTTP + Postgres and in
      Chromium: 45-film tag → 44 added + 1 reported, max 6 requests in flight, re-import changed no row;
      hand-added film linked keeping status/rating/runtime/notes; Thor before Captain America on the
      universe page; double tap → one row; v3 key and v4 token both work; no key 503, bad key, rate
      limit 429, TMDB down — all plain messages, key never in them; mirror-covers skips TMDB posters.
      Migrations: 023 idempotent, drift empty; 024 errors (deletes nothing) before 023, wipes after,
      and skips once anything is imported. **Confirmed working on the live site by the user (2026-10-02)** — 023 and 024 run, `TMDB_API_KEY` set.
- [x] **TV shows from TMDB** (asked 2026-10-02: "same as movies, first delete everything, then
      import; also total hours watched like the other sections"). A show → a series, every numbered
      season → a row ("Name | Season N") with episodes, runtime (average of its episodes), year,
      poster, creator, network; keyword tags import several shows at once; "Watched" marks aired
      episodes only. Re-import / "Check for new seasons" adds seasons, raises episode counts, fills
      blanks. −/+/All episode buttons on season cards. Time watched on the TV page (the old `TvStats`
      that computed it was never rendered — deleted), universe and series headers.
      Verified against a local TMDB stand-in, over real HTTP + Postgres and in Chromium: specials
      skipped; 36-season show fetched in 3 calls (1 + 20 + 16 appended); two "The Office" told apart
      by year; hand-made series linked keeping your title/watched/runtime; standalone moved in, other
      universe left; airing season gained an episode and went Completed → Watching; a season announced
      undated got its year once dated (found and fixed: it took the show's start year); triple tap →
      one series, 3 seasons (advisory lock in an interactive transaction — first use of either here,
      works with the pg adapter); time totals match the DB; 025/026 verified like 023/024.
      **Confirmed working on the live site by the user (2026-10-02)** — 025 and 026 run.
- [x] **Anime from MyAnimeList** (asked 2026-10-02: "the same for anime, maybe derive from
      myanimelist"). Official MAL API v2 only — not the website (robots.txt blocks ClaudeBot) and not
      Jikan (scrapes it). Pick any entry → its run (sequel/prequel links, ≤ 40) in watch order →
      import as a series; one standalone entry stays single; English/romaji title toggle (titles
      stored as MAL gives them — license forbids altering); "Check for new seasons"; −/+/All episode
      buttons (now shared with TV in `components/ui/EpisodeButtons.tsx`); time watched on universe
      and series headers (the Anime page already had it). Verified against a local MAL stand-in over
      real HTTP + Postgres, with hand-entered anime kept: walk from the middle of AoT finds all 7,
      skips the side story, tries a broken link once, caps a 45-entry franchise at 40; your S1 linked
      keeping rating/notes/watched/length; Your Name stayed single; your no-year Frieren moved into a
      new series; refresh added S3 and raised S2's count; triple tap → 1 row. Found and fixed during
      testing: a 2nd "Hunter x Hunter" (1999) joined the 2011 one's series (same-named series counted
      as hand-made — now only if nothing in it is from MAL); refresh pulled in a music clip (now
      skipped); "Journey's" vs typed "journeys" didn't match (apostrophes now dropped — shared with
      films/TV). Known limit: a hand entry titled unlike MAL (e.g. "AoT S2 (my name)") is not matched
      and gets a duplicate — why 028 is recommended. **Not yet run against real MyAnimeList.**
- [x] **Site themes** (asked 2026-10-02: restyle inspired by Gen X Soft Club, Acid Design, Early Cyber,
      Cyberdelia; "i leave it to you"; no AI images). Aesthetics Wiki is behind a Cloudflare challenge
      (403 everywhere, robots.txt too) — not circumvented; researched via web search + CARI/daisyUI.
      Five looks, picked on the portal and at the foot of the Library/Study sidebars, stored in a
      `theme` cookie (server-rendered, no flash; status-bar colour follows): Soft Club (DEFAULT —
      concrete/seafoam/transit blue, Archivo, metro-line menu with station stops, station-sign brand,
      pill buttons, bokeh + grain, frosted panels), Acid (black grid, acid green highlight, chrome
      Unbounded headlines, checkerboard bands, Space Mono "//" labels), Early Cyber (1-bit dither
      desktop, black rules, hard shadows, pinstripe title bars, Pixelify Sans, thermographic bars),
      Cyberdelia (ultraviolet glow, SVG wireframe floor, spectral panel edges, Audiowide 3D-extruded
      titles, spectral buttons), Classic (unchanged). See CODEBASE.md "Looks". Verified in Chromium:
      40+ screenshots across portal/dashboard/lists/forms/study/finances/login/phone logger, no console
      errors; picker switches instantly, persists across reload, sidebar picker works. Found and fixed
      during testing: body background went transparent (wrapper rule caught <body>); Cyberdelia's open
      menu item filled solid; Study/Wardrobe titles are h2s; the 3D-transform floor was invisible
      (perspective() puts the vanishing point at the origin) — redrawn as a flat SVG.
      **LIVE BUG (2026-10-02, user: "clicking on the themes dont change nothing"), fixed:** the deployed
      stylesheet had no theme rules at all — Vercel's build dropped the two `@import`s that came after
      `@import "tailwindcss"` (CSS ignores @import after rules; locally Tailwind inlined them anyway, so
      every local test passed). Now `app/layout.tsx` imports theme-palettes.css and themes.css as their
      own stylesheets. Lesson: check the LIVE CSS (`$PORTAL_URL` is set in this environment — it is the
      apex domain and 308-redirects to www, so curl needs -L) rather than trusting a local build.
- [x] **Soft Club redesign** (user, 2026-10-02: all themes "look like corporate slop with no soul…
      lets start with gen x soft club", with 24 reference images: tDR sleeves, Tresor, Y2K transit, CD
      singles). Pass 1 (pushed 97122f0): one cyan cast, lime and orange lights, Lexend Exa / Share
      Tech Mono / DotGothic16, numbered menu, roll signs, CD-shelf tiles. User: "looks really good
      now", BUT too solid ("in gen x soft club its all blurry and there are no definite lines yet you
      can distinguish the shapes with the colors and by the blurry lines — look at the blur album
      cover and the gen x image"), too much like Classic, and the look picker's other colours throw
      the vibe off. Pass 2:
      - no borders anywhere; panels are glowing haze fields that smear sideways; per-tint glows;
        covers fade at their edges
      - line art behind everything: data text, rules, frames, subway map
      - portal and dashboard sections are a CD tracklist of colour-washed streaks
      - the sidebar is a wash of light, not a column
      - ThemePicker folds into a "Look" menu in every theme: inline on the portal, a popover in
        the sidebars, closes on Escape and outside click
      Checked in Chromium across the portal, dashboard, lists, series, detail, add form, study,
      finances, wardrobe and login, at 1180px and 390px; the production build has no console
      errors besides Speed Insights, which only exists on Vercel. Dev-only noise: Next 16 dev
      intermittently logs "Router action dispatched before initialization" and a layout hydration
      diff on any theme. The same happens without these changes, and the production build is clean.
      Pass 3, after the user said "really good job… just a few problems left": the white panels
      "look like a cheaper way of conveying shapes", so get rid of white backgrounds generally,
      from the images. Replacements:
      - panels are pale-blue film bands between hairline rules with a cyan tab (Ambient Lounge,
        Bowienet), frosting the line art behind them
      - rows and strips are Junkie XL light bars; stat boxes are Kaskade colour blobs
      - dividers are dotted; secondary buttons are GameCube capsules
      Bug caught in testing: the capsule rule caught card links (`a.border.bg-white.rounded-xl`)
      and turned book cards into arches, so card links are now excluded.
      Checked against seeded books, wardrobe, subscriptions, modules and vocab data in the local
      test DB.
      Pass 4 (2026-10-03, user: "the design looks really good now totally on vibe… add animations
      that'll fit the vibe to smoothen the user process"). Planned with the frontend-design skill:
      one orchestrated arrival, everything else answering an action, reduced motion respected.
      - arrival: the page pulls in like carriages, sideways from a blur, and the LED figures
        flicker on
      - actions: the menu sign rolls on navigation; a light passes along a hovered track; a press
        lights up and fades; a field's underline scans in; menus pull into focus; loading
        placeholders get a light scan
      - cut on review: progress bars filling on load, as the stock dashboard move
      Verified with the Web Animations API in Chromium: delays stagger as planned, the roll fires
      on client-side navigation, and reduced motion leaves 0 running animations.
      Pre-existing in every theme: the Library/Study sidebars don't collapse on a phone, so the
      dashboard is squeezed at 390px; the finances page overflows to the right at 390px.
- [x] **Acid redesign** (user, 2026-10-03, 14 reference posters in a zip: "be loyal to
      the design material more than your skills guidelines… I again expect animations"). What the
      references share:
      - ground: black, often on creased paper
      - ink: white line work plus ONE loud accent — acid green mostly, lavender or red-orange
        sometimes
      - structure: chamfered HUD frames, OS windows with "– □ ×", modular outlined grids
      - small marks: capsule tags, >>>> chevrons, barcodes, serials and coordinates, hatch bars,
        crosshairs, ✦ sparkles, the R/RESTRICTED box
      - type: extended heavy caps, blackletter accents, mono small caps, stacked echo words,
        vertical outlined words
      - images: duotone in the accent
      Built: Isolation windows (SVG border-image) on every panel, HUD modules, capsule tags,
      extended-caps titles with acid extrusion, blackletter brand, globe with turning text ring,
      ruled sidebar rail, vertical outlined section word, duotone covers, hatched acid slabs.
      Motion: stepped boots, glitch titles, marching chevrons, cover glitch to colour, blinking
      cursor, scanline. Fixed along the way: the wardrobe's colour swatches used theme grays,
      so "Dark colours" showed light on dark looks; they now use fixed colours.
      Checked in Chromium on portal, dashboard, books, series, finances, study, vocab, wardrobe and
      login at 1180px and 390px; reduced motion leaves 0 animations.
      Pass 2 (user: "love the animations… but it looks too much like the original site… acid is
      based on what people see when they take drugs so it does not look hallucinatory and
      ethereal enough"):
      - liquid: SVG marble fills the edge word and the first module's right half
      - layout: a collage, with the first module double-size and the others tilted
      - titles: holographic, melting through a live SVG displacement filter
      - menu: outlined extended caps
      - effects: drips, drifting auras, hover tracers, thermal-mapped covers
      - filters: in components/ThemeFilters.tsx
      Also fixed the look picker in every theme (user screenshot): the
      capsule rule for outlined buttons turned the picker cards into ovals, so the cards are excluded and
      get their own styling in Soft Club and Acid; card content is top-aligned.
      Pass 3 (user: the feature module's liquid "is supposed to be moving" and "the site works
      really slow" on Acid). Measured on the production build: Acid ran at 31fps vs 60 for the
      other looks. Causes:
      - drifting auras with blur(28px) + a screen blend (the biggest cost)
      - a full-screen screen-blend grain overlay
      - repaint-through-filter animations: holo titles, the flowing edge word, the twinkling
        sparkle inside the filtered title, and an animated feTurbulence
      Fixed:
      - the liquid is a pre-rendered seamless tile, app/acid-marble.webp, made by
        scripts/acid-marble.mjs
      - the feature module pours it down on its own transform-only layer
      - auras without blur or blend, grain without blend, melt static
      Now 60fps on all four pages; reduced motion leaves it still.
- [ ] **Then Early Cyber, then Cyberdelia**
- [x] **Anime: import a whole MyAnimeList list** (user, 2026-10-14, Turkish: log every anime in their
      list with the auto import, all watched, only complete seasons — no films, OVAs, specials,
      recaps). I can't log into the site from here, so it's a page they run once:
      `/library/anime/import` (link on Add Anime)
      - sources: MAL username (official list endpoint with the Client ID — unverified without
        OAuth; clear error pointing to the file if MAL refuses), the user's .xlsx (copy of their
        MAL Completed page, titles only), or MAL's .xml/.xml.gz export (ids)
      - season = TV/ONA, ≥2 ep, ONA episodes ≥10 min; TV short-episode seasons kept (Saiki K.);
        left-out listed by reason, tickable; title rows matched exactly (title/English/synonym),
        type + episode count break ties, no fuzzy guessing → "not found" list
      - groups ticked seasons by their run (existing run route), imports each group as watched
        through the existing import; already-imported start unticked → re-run is a no-op
      - `lib/mal-list.ts` + `lib/xlsx-lite.ts`, 41 tests (synthetic fixture
        `scripts/fixtures/mal-list-page.xlsx`); verified against a local MAL stand-in modelled on
        their list (57 rows): 38 seasons, 18 left out, 1 not found; HxH 148 vs the 1999 decoy,
        Charlotte vs same-name specials; import → 38 watched/COMPLETED in 10 series (MHA grouped
        through a recap between seasons); re-run unticks everything; username path same result
      - the user's file had 266 rows (135 TV, 24 ONA, 37 Movie, 26 OVA, 28 Special, 14 TV
        Special, 1 CM, 1 PV); not committed. The container was reset mid-task and the upload
        was lost with it — they'd upload it again on the page
      - **LIVE BUG (2026-10-14, user): "after some point it errors; what was done stays, the rest needs a
        restart from scratch"** (no screenshot; Vercel showed no runtime logs). Cause: the page retried
        a 429 once and stopped the whole import on any 502/503; a dropped connection threw out of the
        loop. Fixed: up to 5 tries with 5–45 s pauses on 429/5xx/connection loss, keeps going past a
        failed series, and the result offers "Try the N not imported again" (no re-reading the list).
        Verified with a stand-in refusing 10% of requests at random + a mid-import Stop → retry: all
        imported, no duplicates, one series.
      - **needs MAL_CLIENT_ID + 027** (see Blocked, anime)
- [x] **Whole site on a phone** (user, 2026-10-15: "make the whole site work on a phone properly";
      2026-10-18: pick up Claude's WIP and put it on the live site).
      Baseline (Soft Club, 390px): Library/Study squeezed by a 224px sidebar; finance months ~807px
      wide; 59/90 pages had fields under 16px (iOS zoom).
      - [x] phase 1: Library/Study top bar + drawer (`SectionNav`), layouts, looks, 16px fields, ui/*
      - [x] phase 2: per-section pages (portal/login, library, study, finances, shopping, wardrobe)
      - [x] nits: PhoneSheet Escape/focus/scroll-lock; Movies/TV/Mirror/drawer tap heights;
            Early Cyber top bar + drawer close; Cyberdelia top-bar slash hidden; QuickTest wrap
      - [x] shell breakpoint `md` (768) → `lg` (1024), so iPad portrait and phone landscape keep
            the drawer instead of the squeezed sidebar; desktop 1180 still has the sidebar
      - [x] phase 3: 89 routes × 5 looks at 390×844, 445/445 no sideways scroll and no field
            under 16px (`scripts/phone-seed.mjs`, `scripts/phone-audit.mjs`). Drawer closes on
            navigate; delete confirm is a bottom sheet and dismisses on Escape.
      On `main` (fast-forward of `cursor/phone-interface-a49b`). No schema/env changes.
- [x] **Study: flashcards (Anki-style) + quick tests** (user, 2026-10-15: "aside from the full question
      tab, build a flashcard system like anki's, and smaller question pool tests beside that (the full
      question test should stay)"). Full test untouched (only links added to its header).
      - flashcards `/study/sat-vocab/flashcards`: a card per word, SM-2 with Anki's defaults in
        `lib/flashcards.ts` (30 tests), queue + daily limits (20 new / 200 reviews, editable), Undo
        (Z), keys space/1–4, intervals on the buttons, waits for the next learning card
      - quick tests `/study/sat-vocab/quick`: `VocabRun.kind = QUICK`; pools all / To Review /
        Ambiguous / not asked yet / forgotten flashcards; 10/20/30/50; score + missed list
      - `currentRun()` and the daily review now read FULL runs only
      - migration `034-flashcards-quick-tests.sql` (verified: twice, `migrate diff` empty)
      - verified in Chromium on a local DB with the built-in list: quick tests left the full run
        byte-identical; buttons 1m/6m/10m/4d; Easy → due 4am in 4 days; undo; a double answer counted
        once; new-card limit respected
      - **needs 034 run** (see Blocked).
- [x] **Manga: import a whole MyAnimeList list** (user, 2026-10-15: "can you make this for manga as
      well"). Page `/library/manga/import` ("Import list" on the Manga page). Sources: MAL username
      (`/users/{name}/mangalist?status=completed`), MAL's manga export (.xml/.gz), or an .xlsx copy of
      the manga list page — ids from the title cells' links (`sheetLinks` in `lib/xlsx-lite.ts`); a
      link-less line is found by exact title at import, never guessed. Rules in `lib/mal-manga-list.ts`
      (13 tests): novels left out (Books), only Completed. Each manga → the existing
      `/api/manga/mal/import` as read, one at a time, with the shared retrying `lib/fetch-retry.ts`
      (the anime page now uses it too); "Try the N not imported again". `/api/manga/mal/places` unticks
      what's already in. Verified in Chromium against a stand-in refusing 10% at random: manhwa with
      writer/artist split, one-shot by title, light novel left out, hand-added Berserk linked keeping
      progress/rating/notes, re-run → no duplicates, username + unknown-user paths.
      **LIVE BUG (2026-10-15, user's file): "No manga found in that list."** Their file is the
      "All Manga" page: no Type column, status glued to titles ("Blue Lock PublishingAdd - More"),
      reading rows "189 / -" in Chapters, finished ones a bare count. Fixed: Type optional, titles
      cleaned, status + chapter/volume read from Chapters/Volumes; they also asked for Reading ones →
      imported as Reading at their chapter (`progress` on /api/manga/mal/import, capped at the total);
      only on hold/dropped/planned and novels left out; username/export read progress too. Their
      file: 180 rows (93 reading, 87 completed), all with ids (not committed).
      Also: a finished line keeps its list count, used when MAL still calls the series running; and
      `mangaProgress` now counts in volumes when only volumes are logged (chapters 0) — before, "1 of
      6 volumes" with a known chapter total read as not started. Verified with their real file in
      Chromium (stand-in MAL refusing 10%): 179 added, 1 light novel reported, re-run adds nothing;
      only the 4 "Reading" lines with nothing logged stay Plan to read.
      **Needs 032 run + `MAL_CLIENT_ID`** (see Blocked).
- [x] **Finances: installment purchases** (user, 2026-10-09: "like subscriptions but for a limited time
      as there are limited installments"):
      - `Installment` via `033-installments.sql` (verified twice + on a DB without 031)
      - `lib/installments.ts` (33 tests): split to the kuruş, rounding on the first, always adds up
      - counted in carryover, month balances and the month API (so quick log's card balances too)
      - month page "Installments": k/N, this month's share, progress, left + last month, card tag,
        delete with confirm; upcoming "from <month>"; paid off folded away; add form with
        Total/Each, count 2–60, first month 36 back–3 ahead, preview "N × X · until <month>"
      - verified: balances in 5 months match hand-worked deltas to the kuruş (incl. a 333,34
        first installment and an Extra plan running the card negative), move card, delete, 404s,
        7 validation cases; browser flow; Soft Club/Classic/Acid + 390px
      - **needs 033 run** (see Blocked)
- [x] **Manga from MyAnimeList** (user, 2026-10-08: "use the myanimelist api for manga too to derive
      mangas books from"):
      - `Manga.malId` (unique) via `032-manga-mal.sql` (verified: twice, `migrate diff` empty)
      - rules in `lib/mal-manga.ts` (38 tests): format from media type, author/artist from credit
        roles, ongoing from publishing status, 0 = unknown count, title match, fill-blanks merge;
        light novels/novels listed but not imported (Books)
      - `/api/manga/mal/{search,import,refresh}`; "Add Manga" searches MAL first (To read / Read,
        Japanese / English title, reading language); a hand-added manga with the same title is
        linked, never duplicated; "Find on MyAnimeList" links a hand-added one from its page;
        "Check MyAnimeList" fills final counts once a series ends
      - covers from MAL's CDN (unoptimized), excluded from manga mirroring
      - verified against a local MAL stand-in: API cases (link, already, add, read, ongoing,
        manhwa, novel 400, 404, concurrent ×3 → one row, refresh after ending, 409s) and browser
        flows (add, link yours, link from page, check) in Soft Club/Classic/Acid
      - **needs 032 run + MAL_CLIENT_ID** (see Blocked)
- [x] **Finances: money sources** (user, 2026-10-07: "when I am logging expenses I need to select the
      income source too, my base or extra, and it says how many TL is left in which, to see which
      card I should shop with"):
      - `FundSource` on Expense/Subscription via `031-fund-source.sql` (verified)
      - pots carried over separately, Base + Extra = the old total (`lib/fund-sources.ts`, 16
        tests)
      - quick log: "Pay with" picker showing what's left on each card, the last card remembered,
        a warning when the amount is over and the other card has enough, offline = last figures
        minus queued
      - month page: a Base and an Extra card with left / budget-or-income / carried / spent;
        expense and subscription pickers; tap a row's tag to move it
      - fixed on the way: finance writes used `revalidateTag(…, "max")`, which serves stale
        carryover once (wrong balance right after editing an earlier month); now `{ expire: 0 }`
      - verified with hand-worked figures (Base 42,470 / Extra 1,780 / 44,250), moving past and
        present expenses, old queued items (no source → Base), and the browser flow (pick, warn,
        log, offline −40 locally, upload, figures match)
      - **The user must run 031** (see Blocked). Existing expenses and subscriptions all start on
        Base; anything really paid from extra income needs a tap to move it
- [x] **Shopping: products** (user, 2026-10-07: "keep the what I liked and what I didn't section but
      allow me to add a product, their name and comment on that specifically"):
      - `ShopProduct` + `030-shop-products.sql` (cascade with the shop, RLS on, verified)
      - API `/api/shopping/[id]/products[/productId]`, writes scoped to the shop
      - shop page `/shopping/[id]`: notes + Edit + products added, edited and deleted in place
      - map cards list products and link "add a product"; search covers products; saving a shop
        lands on its page; deleting a shop warns how many products go with it
      - Soft Club: products numbered 01, 02 in LED digits in the line's colour, small rings on the
        map
      - verified: API (refusals, cross-shop edit/delete → 404 and unchanged, 401) and a browser
        flow (card → form, add, clear a comment, delete, search, new shop → its page, cascade
        delete leaves 0 rows)
      - **The user must run 030** (see Blocked)
- [x] **Shopping section** (user, 2026-10-07: "add sites of these businesses… write what I liked,
      what I didn't… categorize them like clothing, tech etc… design with just soft club rn, acid
      later"):
      - `Shop` model + `029-shopping.sql` (RLS on), API `/api/shopping`, pages `/shopping`,
        `/new` and `/[id]/edit`, and a portal tile
      - `lib/shopping.ts` with 46 tests: https added, non-http refused, names from domains
        (incl. com.tr / co.uk), categories filed case-insensitively, line codes and colours
      - Soft Club look: a metro map. Categories are glowing lines with ring badges, shops are
        lit stations coded C01, liked in lime and didn't-like in orange; on arrival the line
        draws in and the stations light up in turn
      - verified against local Postgres: the API (create, merge, refuse, edit, clear a note,
        delete twice → 404, 401 without login) and the browser flow (portal → add with
        auto-name → filed under the existing category → edit → delete)
      - 60fps in all looks; reduced motion leaves it still
      - **Acid styling still to do** (the user said later); for now it gets Acid's generic windows
      - **The user must run 029 first** (see Blocked)
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

- **Books: run `035-book-openlibrary.sql`, then `036-book-google-books.sql`, then
  `037-book-owned-kindle.sql`** in the Supabase SQL Editor NOW — the book pages error until
  035 has run; 036 adds `googleBooksId`; 037 adds `ownedKindle` (Kindle, separate from the
  physical `owned` flag). All safe to re-run. Set `GOOGLE_BOOKS_API_KEY` in Vercel (Google
  Cloud → Credentials → API key, enable Books API) and redeploy — Add Book has no other
  catalogue. Never in chat.

- **Study: run `034-flashcards-quick-tests.sql`** in the Supabase SQL Editor NOW — the SAT Vocabulary
  pages error until it has run. Additive, safe to re-run.
- **Finances: run `033-installments.sql`** in the Supabase SQL Editor NOW — the finance pages error
  until it has run. Additive, safe to re-run; works before or after 031 (run 031 too).
- **Manga: run `032-manga-mal.sql`** in the Supabase SQL Editor NOW — the manga pages error until it
  has run. Additive, safe to re-run. Importing also needs `MAL_CLIENT_ID` (same as anime, below).
- **Finances: run `031-fund-source.sql`** in the Supabase SQL Editor NOW — the finance pages error
  until it has run (phone-logged expenses wait safely on the device). Additive, safe to re-run.
  Then move any past expense that was paid from extra income to Extra (tap its tag).
- **Shopping: run `029-shopping.sql`, then `030-shop-products.sql`** in the Supabase SQL Editor —
  the Shopping pages error until both have run (nothing else is affected). Additive, safe to re-run.
  (029 was handed over 2026-10-07; whether it ran is unconfirmed.)
- **Anime from MyAnimeList — in this order:**
  1. Get a Client ID: myanimelist.net (logged in) → myanimelist.net/apiconfig → Create ID. App type
     "web"; the redirect/homepage URL can be the site's address (unused); pick Non-Commercial. Copy
     the **Client ID** (not the secret) into Vercel as `MAL_CLIENT_ID`, then **redeploy**. Never in chat.
  2. Run `027-anime-mal.sql` **now** — the anime pages error until it runs. Additive.
  3. Optional but recommended: `028-clear-anime.sql` **before importing anything** for a clean slate
     (like TV). Skipping it keeps your entries; ones titled like MAL are matched, others duplicate.

- **Network access is now Full** on the Default environment (user changed it 2026-10-01) — it
  applied to the running session immediately.

- **Set up the nightly review** (the routine fires regardless and reports what is missing):
  1. Vercel → project → Settings → Environment Variables: `REPORT_TOKEN` = 32+ random chars,
     then **redeploy** (env changes only reach new deployments).
  2. Claude environment **Default** (the routine's): edited ONLY from claude.ai/code in a browser
     or the desktop app — the cloud "Default" button above a new session's message box → gear
     icon. NOT from inside a session, and not from the iPad app (the gear is hover-only). Add env
     vars `REPORT_TOKEN` (same as Vercel) and `PORTAL_URL` (site address, no trailing slash).
  3. Same dialog → Network access → Custom → add the site's host to Allowed domains, keeping
     "Also include default list of common package managers" ticked. Trusted (the default)
     denies `*.vercel.app` (proxy 403, verified).
  User reported steps 2–3 done on 2026-09-24; a manual test run was fired
  (session `cse_01G3vT8cDNyiXCTVyJFZQUpA`) — its transcript shows which step, if any, still fails.

- **Nightly review: fixed 2026-10-02.** `PORTAL_URL` (Default environment) is the bare domain, which
  308-redirects to www; the routine's curl didn't follow it, so every run got a 308 instead of the
  review (and following it drops the Authorization header across hosts → 401). The routine prompt
  (trig_01CmCeMSpvvCU2xYoyRyNjQy) now resolves the final host without the token, then sends the
  token there. Verified from this environment: HTTP 200 with the day's JSON. Nothing for the user to
  do; optionally set `PORTAL_URL` to the www address.

- **Set the GitHub repo description.** There is no tool for it here; it is Settings → General.
  Suggested: "Personal hub — media library, wardrobe, finances, calendar and a task tracker that
  levels stats. Next.js, Prisma, Supabase."

- **Provide the production URL.** It is recorded nowhere in the repo, so the deploy of the
  hierarchy work has never been checked in the browser — only proven correct locally. It is
  also needed to give exact PWA install instructions.

- **Optional: `prisma/manual-migrations/021-drop-comic-credits-and-dates.sql`** — drops the
  three comic columns. Destructive (their data is deleted) and only AFTER the deploy is live.
  Nothing breaks if it is never run. Verified: drift before it was exactly its three drops,
  re-run is a no-op, `migrate diff` empty after, app still fine with the columns gone.

- **Run `prisma/manual-migrations/020-study-goals.sql`** after 019 — additive (goal column +
  `StudyConfig`). The deployed code reads these, so **/study and the nightly report error until it
  runs.**

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

- Migration `022-comicvine.sql` is **applied** — inferred: the user confirmed the comics import
  works on the live site, and every comics page reads `comicVineId`. `COMICVINE_API_KEY` is in Vercel.
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

- **Always merge finished work into `main`.** Vercel production is `main` only — other branches
  are not published as the site. Fast-forward when possible; don't leave a completed feature
  sitting on a `cursor/` branch.

- **Commit work in progress before long test runs.** On 2026-10-14 the container was reset
  mid-task: everything uncommitted (and the user's upload) was gone, and the repo came back empty.

- **`.claude/skills/frontend-design/`** is Anthropic's frontend-design skill, copied unmodified
  from anthropics/claude-plugins-official (commit d182ca4; `/plugin install` isn't available in
  these cloud sessions). It is Apache-2.0, so its `LICENSE.txt` must stay beside it. Use it for UI
  and theme work. Where it warns against a device the user asked for (Soft Club's numbered menu,
  mono labels, middle-dot meta lines), the user's brief wins, as the skill itself says.
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
