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

## Looks (themes)

Five looks, picked from a folding "Look" menu on the portal or at the foot of the Library and Study
sidebars. It stays closed until opened, so the other looks' colours don't clash with the one showing:
**Soft Club**
(default), **Acid**, **Early Cyber**, **Cyberdelia** and **Classic** (the original). The choice is a
`theme` cookie (per device, a year), so the root layout renders `data-theme` on `<html>` and the right
look paints first — no flash; `generateViewport` sets the matching status-bar colour. Switching is
instant: `lib/theme-client.ts` sets the attribute and the cookie; pickers read it back through
`useSyncExternalStore`, so two on one page agree.

It works without touching pages because Tailwind v4 draws every colour utility from a CSS variable.
`app/theme-palettes.css` (GENERATED by `scripts/theme-palettes.mjs` — edit the script, re-run it; imported by `app/layout.tsx`, never `@import`ed from globals.css, which Vercel's build silently dropped)
redefines the gray ramp, white and 17 hue ramps per theme; dark themes mirror the ramps, so
`bg-gray-50` is the darkest surface, `text-gray-900` the brightest text and a `bg-green-100
text-green-700` pill stays legible. `app/themes.css` adds what a palette can't: typefaces (next/font,
`preload: false`, so only the active theme's fonts download), backdrops on `body::after`/`::before`,
radii and shadows via Tailwind's `--radius-*`/`--shadow-*` variables, and signature touches keyed off
hook classes in the shells — `theme-sidebar`, `theme-brand`, `theme-nav`, `theme-nav-item[data-active]`,
`theme-header`, `theme-tile`. Unlayered CSS beats Tailwind's layered utilities, so a skin can restyle
`.bg-gray-900` without `!important`. Page titles are `h1` or `h2.text-2xl` (Study, Wardrobe).
Hardcoded colours defeat this: the dashboard donut uses `var(--color-*)` through `style`, since SVG
presentation attributes can't read CSS variables. Classic has no rules — Tailwind's own palette.
Inspired by the Aesthetics Wiki's pages (behind a Cloudflare challenge, so researched via web search
and the CARI / daisyUI trend write-ups); everything is drawn in CSS and inline SVG, no images.

Soft Club was redrawn twice from the owner's own reference images. The second pass followed their
note to look at Blur's "blur" sleeve and the "Gen X / contemporary soft club" collage: there are no
outlines anywhere. A rule sets every border transparent. The third pass, prompted by "the white
backgrounds look cheap", replaced white with the references' own ways of grouping:
- **Panels** are a band of pale blue film between hairline rules, open at the sides (Ambient
  Lounge): a doubled cyan-and-white rule on top, a white one at the foot and a short cyan index tab
  (Bowienet). The film blurs the line art behind it with `backdrop-filter`, except on card links,
  which can come by the dozen. A panel holding an open dropdown (`ul.absolute`) is lifted above its
  neighbours, since frosting makes each panel its own stacking context.
- **Rows and header strips** (`bg-gray-50`, tinted strips) are Junkie XL's light bars: a bright
  top edge and a streak fading to the right.
- **Stat boxes** (tinted `.flex-col.items-center.justify-center`) are soft colour blobs, like Kaskade.
- **Dividers** (`divide-y`) are Bowienet's dotted rules.
- **Secondary buttons** are GameCube capsules: a faint tint, a thin white edge and a cyan glow.
  Full-width choices are light bars instead.
- **Colour:** each Tailwind tint class names `--sc-glow` (its own colour) and `--sc-blob` (its
  200 shade, to draw with). Chips and solid buttons glow in theirs.

Photos and covers fade at their edges (mask-image).

**Motion** (the end of the Soft Club section in `app/themes.css`). The idea is a city seen from a
train: things travel sideways and arrive smeared, resolving into focus, all on one easing curve
(`--sc-ease`). Only the page's arrival plays unasked: its blocks, the children of the page root
(or of `<main>` when it has several), come in one by one, and tracklists come in track by track.
Each block's stagger is kept in `--sc-delay`, so the LED figures inside it flicker on as it stops.
Everything else answers an action:
- **Navigating:** the active menu item's sign rolls up to the new page. CSS animations start when
  `[data-active]` is applied, so this needs no JS.
- **Hovering a track:** a light passes along it, behind the words.
- **Pressing:** a light comes on at once and fades out (`transition-duration: 0s` on `:active`).
- **Focusing a field:** its cyan underline scans across.
- **Opening a menu:** the look menu and dropdowns pull into focus.
- **Loading:** placeholders get a scanning light instead of Tailwind's pulse.

All of it is inside `prefers-reduced-motion: no-preference`; the press and focus states still
show, just without movement. Because CSS animations start when a rule starts applying, switching
the look to Soft Club plays the arrival once.

**Acid** was redrawn from the owner's 14 reference posters: new-acid streetwear and rave prints
such as Worldwide, Hachiroku, Isolation, Sanctuary, Parkineos and Before EP. The owner asked for
loyalty to the material over general design guidance.
- **Ground:** creased black paper, an SVG `feTurbulence` + `feDiffuseLighting` tile, with print
  grain on top.
- **Structure:** white line work. Every container is an OS window from Isolation: a cut-corner
  frame with a title bar and "– □ ×", drawn as an SVG `border-image` sliced 30/60/12/12, so it
  needs no markup. Card links are plain cut-corner HUD frames that switch to acid on hover.
- **Colour:** one loud ink, `--ac-acid` #8cff3a; the palette also leans blue toward lavender
  and red toward red-orange, the posters' other inks.
- **Type:** titles are extended Archivo (`font-stretch: 125%`, 900) with an acid extrusion. The
  brand is blackletter (Pirata One) over a barcode and "EST. MMXXVI —". Section labels are
  capsule tags, like SUPER RACKS, and the small print is mono caps after a ✦.
- **Furniture:**
  - the sidebar has a ruled rail with tick marks
  - the open page is marked with a crosshair and marching chevrons
  - Worldwide's globe sits under the menu inside a ring of text that turns
  - the section's name runs up the right edge in huge outlined caps (`:root::before`, chosen
    by `:has()`)
  - portal and dashboard sections are HUD modules with a serial (NO.01) and chevrons
  - main actions are hatched acid slabs with cut corners
- **Pictures:** duotone acid until hovered, like Sanctuary's statue.
- **Motion:** stepped, never eased.
  - blocks and modules boot open in stepped wipes, one after another
  - titles glitch in, splitting into red, lavender and acid
  - chevrons march; hatch stripes slide on a hovered action
  - a cover glitches into its real colour
  - a focused field gets a blinking acid cursor block
  - loading is a scanline
  - all of it sits inside `prefers-reduced-motion: no-preference`

Acid's second pass answered the owner's note that it was "not hallucinatory and ethereal enough"
and too much like the original. It adds the liquid half of the posters to the HUD half:
- **Liquid:** marbled liquid, an SVG of the posters' inks warped by `feDisplacementMap`, fills the
  edge word and pours into the right half of the first module.
- **Layout:** that first module is twice the size; the others sit at slight angles, like a collage.
- **Titles:** large, holographic chrome that shifts, split into lavender and orange, and melting
  through the live `#ac-melt` filter.
- **Menu:** outlined extended caps; the open page is solid acid.
- **Effects:**
  - drips hang from the header and the brand, slowly stretching
  - iridescent auras drift behind everything
  - hovering a card leaves outlined tracers in acid, lavender and orange
  - covers are mapped to thermal colour (`#ac-thermal`)

The SVG filters live in `components/ThemeFilters.tsx`, rendered by the root layout, because Chrome
only applies `filter: url(#id)` to a filter in the same document. Under reduced motion, titles use
`#ac-melt-still`.
The lines are graphics laid over the haze on `:root::before`: columns of data text, long rules, two
offset frames and a subway map, slightly blurred and glowing. The data text runs down the sidebar's
edge where there is one, and the frames and map are hidden on phones. The portal's and dashboard's
sections become a CD tracklist: one streak per track, an LED track number, the section's colour
washed in at the start (`--sc-hue`) and the light fading out to the right. They are laid out by CSS
grid over the existing markup (`display: contents` on the icon row). Masks clip anything that
overflows, so they are only used on tracks, menu items and images, never on panels that may hold a
dropdown or dialog. Floating panels (`.fixed`, `.absolute`, the look menu) are near-opaque. The
theme's glows replace Tailwind's ring shadows, so keyboard focus is an outline. Type stays as before:
lowercase Lexend Exa light titles with a lime full stop, Share Tech Mono `<labels>`, DotGothic16 LED
numbers. The open menu item and the dark badges are navy roll signs, blurred. The lime target sits
under the sidebar menu, or in the corner on pages without a sidebar, beside a row of fading orange
dots.
The other three looks are first drafts and are to be redone the same way, from references.

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
| `themes.ts` / `theme-client.ts` | The looks and the cookie that picks one / applying a look in the browser |
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
