# MyPortal — architecture

A personal hub: **Library**, **Wardrobe**, **Finances**, **Calendar** and **Tasks**, behind one
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
this reason: `lib/tasks.ts` (rules, importable anywhere) vs `lib/task-service.ts` (Prisma).

**Dates are date-only, and local.** Calendar dates are `"YYYY-MM-DD"` keys in code and Postgres
`date` columns, converted only through `lib/calendar-dates.ts`, which pins everything to
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

**Calendar.** `EventModule` is a reusable event — a title plus the minutes it occupies. It is
placed into a `DayPlan` (a named SCHOOL or HOLIDAY template) via `DayPlanModule`, and a plan is
dealt onto a real date as a `CalendarDay`. `SchoolTerm` and `DayOff` decide whether a date is a
school day or a holiday. `DayActivity` is legacy, kept as the only surviving copy of the
pre-module timetables.

**Tasks.** A `Task` is one `EventModule` on one date, **materialised from the calendar** on first
read rather than created by hand — unique on `(moduleId, date)`, which is what makes that
idempotent. You work it with `TaskSession`s; clear half the module's booked hours and it
completes, otherwise it fails. Completion pays `XpAward` rows: one XP per minute worked, to each
of the up-to-three `Stat`s its module trains. `StudySession` is free study when nothing is
scheduled — no window, no bar, so it can neither complete nor fail and never moves a day's
verdict, but it banks time and pays three randomly rolled stats. `XpAward` points at exactly one
of a task or a study session.

**APs.** `ApCourse` and `ApUnit`, seeded from College Board CEDs. Courses sharing a `series`
(Physics C) render as one continuously-numbered sequence. Ticking a unit stores a timestamp, so
it doubles as "finished on".

---

## Layout

```
app/
  (portal)          app/page.tsx — the five section cards
  library/…         eight media types, each list / detail / edit / new
  wardrobe/…        garments and wash loads
  finances/…        month view, plus /log (installable PWA)
  calendar/…        month, day, day plans, modules, terms
  tasks/…           today, stats, APs
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
| `calendar-dates.ts` | Date keys, the app timezone, `instantAt` |
| `calendar-shuffle.ts` | Whether a date is a school day, and dealing plans onto dates |
| `tasks.ts` / `task-service.ts` | Task rules (client-safe) / Prisma side |
| `leveling.ts` | The XP curve: `level = floor(k · ln(1 + xp/30k))`, k = 10 |
| `stats.ts` | The fourteen stats and their presentation |
| `wash-calculator.ts` | Care labels → machine settings |
| `finances.ts` / `finances-utils.ts` | Month maths and carryover |
| `expense-queue.ts` | The offline logger's IndexedDB queue |

---

## Testing

`npm test` runs plain node scripts over the pure modules — status derivation and calendar date
maths. There is no browser test suite; UI and schema changes are verified by running the app
against a throwaway Postgres and driving it, because the bugs that mattered here were only
visible in the **database**, not on screen. The offline expense logger passed every browser
check while writing four rows for three expenses.
