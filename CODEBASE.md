# MyPortal — architecture

A personal hub: **Library**, **Wardrobe**, **Finances** and **Study**, behind one
password. Next.js App Router on Vercel, Prisma against Supabase Postgres, Tailwind.

This file covers how the pieces fit and the conventions that hold across them. For what is done
and what is pending, read `.claude/PROGRESS.md`.

---

## Conventions

These hold everywhere; breaking one is usually a bug.

**Pages are server components and query Prisma directly.** Anything touching the database sets
`export const dynamic = "force-dynamic"`. A production build must succeed with **no reachable
database** — if it doesn't, a page is being prerendered that shouldn't be.

**Mutations go through route handlers,** not server actions. The client `fetch`es, then calls
`router.refresh()`. Handlers are wrapped in `withErrors` (`lib/api-errors.ts`) so every failure
path still returns JSON — a bare 500 with an HTML body makes clients throw inside `res.json()`.

**Bodies are validated with zod.** Invalid input is a 400 with `{ error, issues }`, never a 500.

**Client components must not import anything that reaches `lib/db`.** That pulls `pg` into the
browser bundle and fails at build. Pure rules live apart from their database access for exactly
this reason: `lib/study.ts` (rules, importable anywhere) vs `lib/study-service.ts` (Prisma).

**Dates are date-only, and local.** Dates are `"YYYY-MM-DD"` keys in code and Postgres
`date` columns, converted only through `lib/dates.ts`, which pins everything to
`APP_TIME_ZONE` (`Europe/Istanbul`). The server runs in another zone, so "today" is never
`new Date()` on the server. Weeks start Monday.

**Schema changes are hand-written SQL.** `prisma db push` cannot reach this Supabase instance.
See `prisma/manual-migrations/README.md`. Every new table needs
`ENABLE ROW LEVEL SECURITY` — Supabase serves `public` over REST, and new tables do not inherit it.

---

## Authentication

`proxy.ts` (the Next 16 name for what used to be `middleware.ts`, and now on the Node.js
runtime) guards every route except `/login`, `/api/auth` and the PWA install assets iOS fetches
unauthenticated. `/api/*` gets a 401 JSON rather than a redirect — redirecting an API caller
produced a 200 that `fetch()` read as success, so forms hung on "Saving…" forever.

The session cookie holds an **HMAC-signed token** (`lib/session.ts`): a payload of issued-at,
expiry and a random `jti`, signed with `AUTH_SECRET` via Web Crypto. The cookie must never
contain `AUTH_SECRET` itself — a leaked cookie would then *be* the environment secret,
unrevocable and shared by every session. `POST /api/auth` checks the password against
`AUTH_PASSWORD`, rate-limited; `DELETE /api/auth` logs out.

One exception to "everything needs a session": the nightly review job has none, so it reads
`GET /api/study/review` with `Authorization: Bearer <REPORT_TOKEN>` instead. The proxy lets that
through for **that exact path and method only** — any other path, POST, or a sibling like
`/api/study/review/x` is still a 401. The token is read-only by construction and fails closed:
unset or under 32 characters, nothing matches, so a missing variable cannot open the endpoint.
It is compared over SHA-256 digests with no early exit.

---

## Data model

36 models, 22 enums. The shape by area:

**Library.** Each medium has a status derived from progress counts, never set by hand
(`lib/derive-status.ts`). Four media have parent hierarchies with `SET NULL` foreign keys, so
deleting a parent orphans children rather than destroying them:

- Books — `BookUniverse → BookSeries → Book`
- Anime — `AnimeUniverse → AnimeSeries → Anime`
- TV — `TvUniverse → TvSeries → TvShow`
- Films — `MovieUniverse → Movie` (no series tier)
- Comics — `ComicPublisher → ComicUniverse → ComicTitle → ComicIssue`, the one hierarchy where
  the leaf is an issue rather than the work itself

Standalone: `Manga`, `Game`, `Article`, `Garment`.

**Comics from Comic Vine.** "Add Comic" searches Comic Vine and imports a whole run: the comic, named
with its start year ("The Amazing Spider-Man (1963)" — Marvel reuses titles), and every issue with its
name and cover. `ComicTitle.comicVineId` remembers the run, unique per universe, so importing it again
— "Check for new issues" on the comic's page — only adds what is missing. The merge rule is in
`planMerge`: an import creates missing issues and fills a blank name or cover, and never writes
read, owned, rating, rereads, notes or anything you set yourself. Issue numbers arrive as strings;
"½", "-1" and "1.5" are placed, "1.MU" and collisions like "1.1"/"1.10" are reported, not guessed.
Covers are hotlinked and rendered `unoptimized`, and excluded from cover mirroring. The key,
`COMICVINE_API_KEY`, is server-only. (marvelreading.com was the first choice; it blocks automated
access with a Cloudflare challenge and its robots.txt disallows ClaudeBot, so it is not used.)

**Movies from TMDB.** "Add Movie" searches TMDB for films, collections ("Harry Potter Collection")
and keyword tags ("marvel cinematic universe (mcu)" — the MCU has no TMDB collection). A film is
added in one tap; a collection or tag opens a preview with checkboxes, listed in release order, and
imports the ticked films — up to 100, six detail requests at a time. Each arrives with director(s),
lead studio, runtime, year, original language and poster. `Movie.tmdbId` is unique (a film is in the
library once, in at most one universe); `imdbId` is kept only to link to IMDb. The merge rule is
`planImport`: match by TMDB id, else once by title + year to a film added by hand (which is then
linked); fill blanks only — never title, status, rating, rewatches, notes or language; a standalone
film moves into the universe being imported into, a film in another universe stays and is reported.
Runtime 0 means "not known yet" (a film imported before release); importing it again fills it.
New rows are stamped a millisecond apart so a universe page (year, then `createdAt`) keeps release
order within a year. Posters are hotlinked from image.tmdb.org, rendered `unoptimized`, and excluded
from cover mirroring — TMDB's terms limit how long its content may be kept. TMDB requires its
attribution notice and logo wherever its data is used (`TMDB_NOTICE`, `public/tmdb-logo.svg`). The key,
`TMDB_API_KEY` (a v3 key or a v4 read token — both work), is server-only. Cards carry a one-tap
Watched toggle. (IMDb was the first choice; its Conditions of Use forbid robots and scraping without
written consent and it has no public API, so it is not used.)

**TV shows from TMDB.** "Add Show" (main page) and "Add Series" (in a universe) search TMDB for
shows and keyword tags (TV has no TMDB collections). A show becomes a `TvSeries` (`tmdbId` unique,
`imdbId` for the link) and every numbered season a `TvShow` row titled "Name | Season N" — specials
(season 0) are left out. Each season's runtime is the average of its episodes' runtimes (falling back
to the show's average, its listed runtime, then 45); its episode count is the episodes TMDB lists.
Seasons are fetched by appending `season/N` to `/tv/{id}`, 20 per call (TMDB's limit). "Watched"
imports mark only aired episodes (air date ≤ today in the app's zone), so an airing season lands as
Watching. Re-importing — "Check for new seasons" on a series — runs `placeSeries` + `planSeasons`:
adds missing seasons, raises an episode count TMDB has grown (never lowers it; status re-derived),
fills blank year/poster/creator/network, and never touches episodes watched, title, runtime,
rating, rewatches, notes or language. A season's year stays blank until TMDB dates it, since a stored
year is never overwritten. Placement follows films (moved/linked/already/elsewhere); a name clash in
a universe gets the start year ("The Office (2005)"). Each show lands in its own interactive
transaction holding `pg_advisory_xact_lock(namespace, tmdbId)`, so a double tap makes one series.
Season cards carry −/+/All episode buttons; time watched (episodes × runtime × passes,
`tvWatchedMinutes`) shows on the TV page, universe and series headers via `formatTotalTime`.

**Anime from MyAnimeList.** "Add Anime" and a universe's "Add Series" search MyAnimeList through its
official API v2 (`MAL_CLIENT_ID`, sent as `X-MAL-CLIENT-ID`; server-only — the license forbids sharing
it). Not the website (robots.txt turns away Claude's crawlers) and not Jikan (it scrapes the website).
On MAL every season, film and special is its own entry, so `Anime.malId` is per row (unique). Picking
any entry walks its run over sequel/prequel links only (`walkRun`, ≤ 40, nearest first; side stories,
spin-offs, recaps excluded; a broken link tried once) → a preview in watch order (start date) →
ticked entries become one series, numbered in order; music/promo entries start unticked. A single
entry imported standalone stays a single anime. Titles are stored exactly as MAL gives them — English
or MAL's main (romaji) title by a toggle — since the license forbids altering its content. Matching
(`matchEntries`): MAL id, else once by any of its titles + year against rows added by hand; titles
that differ more than punctuation/case are not matched, so a kept hand library can gain duplicates
(hence the optional 028 clean slate). `chooseSeries`: the series holding most matched rows; else a
same-named series with nothing from MAL in it; else new (name + year, then MAL id, if taken).
`planEntries` only adds: fills studio/airing season/year/poster/season number, raises an episode
count, never touches title, episodes watched, episode length, rating, rewatches, notes, language.
"Watched" marks finished entries fully; airing ones stay at 0 (MAL has no episode dates). "Check for
new seasons" (`refreshSeries`) walks again and adds only entries newer than the newest the series has
(not music/promos), keeping the series' title language. Per-run advisory locks (sorted ids) inside an
interactive transaction stop a double tap duplicating. Posters hotlinked from cdn.myanimelist.net,
excluded from mirroring. `normaliseTitle` drops apostrophes ("Journey's" = "Journeys").

**Finances.** `FinanceConfig` (budget), `Expense`, `AdditionalIncome`, `Subscription`. Expenses
carry a unique `clientId` so the offline logger can retry without duplicating — a client-side
lock cannot prevent double submission across two tabs, so idempotency is enforced in the database.

**Study sessions.** A `Module` is a thing you study: a title and the one-to-three `Stat`s it
trains. It has no hours and no place in a day — you pick one when you start a `StudySession`, and
stopping pays `XpAward` rows of one XP per whole minute to each of those stats. A session started
without a module rolls three stats at random instead, for one-off work not worth naming.

A session **snapshots** both the stats it pays and the module's title, rather than reading them
back through the relation. That is what makes the history stable: re-pointing a module's stats
cannot rewrite what past sessions earned, and deleting a module (`SetNull`) leaves its sessions
readable by name instead of silently turning them into free ones.

**Weekly goals.** `Module.weeklyGoalMinutes` is a per-module target and `StudyConfig` (one row,
id `global`, like `FinanceConfig`) holds the overall one; both nullable, both in minutes so 7.5h
is exact. Progress is not stored — it is this week's session time, Monday to Sunday in Istanbul,
with a running session added live. Free study counts toward the overall goal only. The per-day
figure counts today as a day left and rounds up, so it never asks for less than what remains.

`ApCourse`/`ApUnit` hold the College Board unit lists; ticking a unit sets `completedAt`.

**Daily review.** `/study/review` (and the same thing as JSON at `/api/study/review`) adds up one
day: time per module, XP and level-ups per stat, the study streak, AP units ticked and SAT
questions answered. It has no table of its own — it is assembled from the rows above. The rule
that matters is the day boundary: sessions carry a date, but AP ticks and vocabulary answers are
instants, and 00:30 in Istanbul is still the previous day in UTC. Everything is bucketed through
`todayKey`, the same function that defines "today" everywhere else. A 23:15 scheduled Claude
routine reads the JSON and writes the evening report.

**Study.** `VocabWord` has one or more `VocabMeaning`s, and every meaning becomes one question.
A `VocabRun` is a sitting of the test, holding a `VocabQuestion` per meaning with its shuffled
options. The three categories are the verdicts on the current run's questions, so starting a new
run is what resets them. The rule that keeps the test honest: a question's distractors never
include another sense of the same word, which would be a second correct answer.

**APs.** `ApCourse` and `ApUnit`, seeded from College Board CEDs. Courses sharing a `series`
(Physics C) render as one continuously-numbered sequence. Ticking a unit stores a timestamp, so
it doubles as "finished on".

---

## Layout

```
app/
  (portal)          app/page.tsx — the four section cards
  library/…         eight media types, each list / detail / edit / new
  wardrobe/…        garments and wash loads
  finances/…        month view, plus /log (installable PWA)
  study/…           sessions, modules, stats, APs, SAT vocabulary
  api/…             route handlers, grouped by section
components/<section>/   client components, one folder per section
lib/                    rules, database access, helpers
prisma/
  schema.prisma
  manual-migrations/    idempotent SQL, applied by hand
scripts/                node test scripts, graph sealing
```

### `lib/` worth knowing

| Module | What it holds |
|---|---|
| `db.ts` | The Prisma singleton and its connection guard |
| `session.ts` | HMAC session tokens, shared by middleware and route handlers |
| `api-errors.ts` | `withErrors`, `readJson` |
| `derive-status.ts` | Progress counts → status, for every medium |
| `dates.ts` | Date keys and the app timezone |
| `study.ts` / `study-service.ts` | Session and XP rules (client-safe) / Prisma side |
| `comicvine.ts` / `comicvine-service.ts` / `comicvine-import.ts` | Issue numbers, covers and the merge rule / the API client / landing a run in a universe |
| `tmdb.ts` / `tmdb-service.ts` / `tmdb-import.ts` | Reading TMDB's answers and the merge rule / the API client / landing films in the library |
| `tmdb-tv.ts` / `tmdb-tv-import.ts` | Shows: reading seasons, `placeSeries` and `planSeasons` / landing shows as series + seasons |
| `mal.ts` / `mal-service.ts` / `mal-import.ts` | Anime: reading entries and the merge rules / the MAL API client and run walk / landing runs as series |
| `goals.ts` / `goal-schema.ts` | Weekly-goal arithmetic and its wording / the zod rule both goal routes share |
| `review.ts` / `review-service.ts` | The daily review's rules — day boundaries, streaks, level-ups / its queries |
| `leveling.ts` | The XP curve: `level = floor(k · ln(1 + xp/30k))`, k = 10 |
| `vocab.ts` / `vocab-service.ts` | Parsing a pasted word list, and building the test / its Prisma side |
| `stats.ts` | The fourteen stats and their presentation |
| `wash-calculator.ts` | Care labels → machine settings |
| `finances.ts` / `finances-utils.ts` | Month maths and carryover |
| `expense-queue.ts` | The offline logger's IndexedDB queue |

---

## Testing

`npm test` runs plain node scripts over the pure modules — status derivation, date maths, the
XP rule, the level curve, the vocabulary parser and question builder, the daily review, the
report token, and the Comic Vine, TMDB (film and TV) and MyAnimeList merge rules. `scripts/alias.mjs` teaches node the `@/` import alias, so a pure module can
import another the same way the app does. There is no browser test suite; UI and schema changes are verified by running the app
against a throwaway Postgres and driving it, because the bugs that mattered here were only
visible in the **database**, not on screen. The offline expense logger passed every browser
check while writing four rows for three expenses.
