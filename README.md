# MyPortal

A personal hub, deployed on Vercel and backed by Supabase Postgres. Five sections, one login:

| Section | What it is |
|---|---|
| **Library** | Books, anime, manga, comics, films, TV, games and articles. Series and universe hierarchies, progress tracking, derived status, Steam sync. |
| **Wardrobe** | Garments with care labels, turned into real machine settings and a wash-urgency ranking. |
| **Finances** | Monthly budget, expenses, additional income and carryover, in TRY. Includes an installable mobile expense logger that works offline. |
| **Calendar** | Reusable event modules placed into day plans, and day plans dealt onto real dates around school terms and days off. |
| **Tasks** | Work sessions against the calendar's modules, levelling fourteen stats. Plus study-time totals and an AP unit tracker. |

## Running it

```bash
npm install
npx prisma generate     # `npm run build` does this for you
npm run dev
```

Needs a `.env` with at least:

```
DATABASE_URL=postgresql://…     # Supabase Postgres
AUTH_SECRET=…                   # signing key for the session cookie
AUTH_PASSWORD=…                 # the password you log in with
```

Optional, per feature: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (cover uploads),
`STEAM_API_KEY` / `STEAM_USER_ID` / `STEAMGRIDDB_API_KEY` (Steam sync),
`NEXT_PUBLIC_APP_TIMEZONE` (defaults to `Europe/Istanbul` — this is what "today" means for the
calendar and tasks, and the server runs in a different zone).

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # status derivation + calendar date maths
npm run build       # the real gate — catches what tsc alone misses
```

`npm run build` must pass **without a reachable database**. Nothing is prerendered that touches
Postgres, so a build failing on a database error means a page is missing `force-dynamic`.

## Schema changes

`prisma db push` cannot reach this project's Supabase instance, so schema changes are written as
idempotent SQL in [`prisma/manual-migrations/`](prisma/manual-migrations/) and pasted into the
Supabase SQL editor. **Additive migrations run before the deploy; removals run after it.** See
that directory's README for the run order and the reasoning.

Every new table needs `ENABLE ROW LEVEL SECURITY` — Supabase exposes `public` over its REST API,
and a new table does not inherit RLS from its neighbours.

## Finding your way around

- [`CODEBASE.md`](CODEBASE.md) — architecture: the data model, the conventions, how a section hangs together.
- [`graphify-out/`](graphify-out/) — a queryable knowledge graph of the code. See [`AGENTS.md`](AGENTS.md).
- [`.claude/PROGRESS.md`](.claude/PROGRESS.md) — what is done, what is next, and anything waiting on a human.
