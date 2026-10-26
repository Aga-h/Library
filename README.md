# MyPortal

A personal hub, deployed on Vercel and backed by Supabase Postgres. Five sections, one login:

| Section | What it is |
|---|---|
| **Library** | Books, anime, manga, comics, films, TV, games and articles. Series and universe hierarchies, progress tracking, derived status, Steam sync. |
| **Self Care** | Today's meals from the monthly diet plan, ticked off as you eat them, with a water log toward the day's goal — installable on the home screen as "Diet", and usable offline; and the wardrobe: garments with care labels, turned into real machine settings and a wash-urgency ranking. |
| **Finances** | Monthly budget, expenses, additional income and carryover, in TRY. Includes an installable mobile expense logger that works offline. |
| **Study** | Timed study sessions against named modules, levelling fourteen stats. Plus study-time totals, an AP unit tracker and a SAT vocabulary test. |

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
REPORT_TOKEN=…                  # optional: 32+ random chars; lets the nightly review read /api/study/review
WIDGET_TOKEN=…                  # optional: 32+ random chars; the phone widgets in scriptable/ (see its README)
COMICVINE_API_KEY=…             # optional: comicvine.gamespot.com/api — lets Add Comic import a whole run
TMDB_API_KEY=…                  # optional: themoviedb.org API key or read token — film and TV imports
MAL_CLIENT_ID=…                 # optional: myanimelist.net/apiconfig Client ID — anime and manga imports
GOOGLE_BOOKS_API_KEY=…          # Google Cloud Books API key — Add Book search (enable the Books API)
```

Book import searches Google Books. Without a key Google's anonymous quota often 403/429s, and
search has nothing else to fall back on.

Optional, per feature: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (cover uploads),
`STEAM_API_KEY` / `STEAM_USER_ID` / `STEAMGRIDDB_API_KEY` (Steam sync),
`SITE_URL` (the site's address, e.g. `https://example.com` — on Vercel the production domain is
used when it is unset), `NEXT_PUBLIC_APP_TIMEZONE` (defaults to `Europe/Istanbul` — this is what "today" means for the
study sessions, and the server runs in a different zone).

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # status derivation, date maths, XP + level curves, vocabulary
npm run build       # the real gate — catches what tsc alone misses
```

`npm run build` must pass **without a reachable database**. Nothing is prerendered that touches
Postgres, so a build failing on a database error means a page is missing `force-dynamic`.

## Schema changes

`prisma db push` cannot reach this project's Supabase instance, so schema changes are written as
idempotent SQL in [`prisma/manual-migrations/`](prisma/manual-migrations/) and pasted into the
Supabase SQL editor. **Additive migrations run before the deploy; removals run after it.** See
that directory's README for the run order and the reasoning.

**A new, empty database** (a copy of this site) skips all that: paste
[`prisma/fresh-install.sql`](prisma/fresh-install.sql) into the SQL editor once. It is the whole
schema, row level security on, and can be done entirely in the browser.

Every new table needs `ENABLE ROW LEVEL SECURITY` — Supabase exposes `public` over its REST API,
and a new table does not inherit RLS from its neighbours.

## Finding your way around

- [`CODEBASE.md`](CODEBASE.md) — architecture: the data model, the conventions, how a section hangs together.
- [`.claude/PROGRESS.md`](.claude/PROGRESS.md) — what is done, what is next, and anything waiting on a human.
