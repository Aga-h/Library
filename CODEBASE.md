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
XP rule, the level curve, the vocabulary parser and question builder, the daily review, and the
report token. `scripts/alias.mjs` teaches node the `@/` import alias, so a pure module can
import another the same way the app does. There is no browser test suite; UI and schema changes are verified by running the app
against a throwaway Postgres and driving it, because the bugs that mattered here were only
visible in the **database**, not on screen. The offline expense logger passed every browser
check while writing four rows for three expenses.
