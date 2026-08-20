# Manual migrations

`prisma db push` cannot reach this project's Supabase instance from the usual dev
environments (the pooled connection rejects DDL, and the direct host is not always
reachable), so schema changes are applied by pasting these scripts into the
**Supabase → SQL Editor**.

Every script here is **idempotent** — safe to run again if you are unsure whether it
already went through.

Apply them in filename order, then run `npx prisma generate` locally so the client
types match.

**Which side goes first depends on the direction of the change.** A migration that *adds*
something must run **before** the code that uses it. A migration that *removes* something —
`008` is the first — must run **after** the code that stopped referencing it, because Prisma
names every column explicitly in its `SELECT`s and will fail on a column its schema still
declares. Getting this backwards is what broke books and manga once already.

| Script | What it does |
|---|---|
| `001-comics-hierarchy-and-indexes.sql` | Replaces the flat `Comic` table with the Publisher → Universe → Title → Issue hierarchy, adds `Subscription`, and applies the index tuning from the repo audit. |
| `004-tv-hierarchy-and-comic-covers.sql` | Gives TV a Universe → Series → Season hierarchy with real foreign keys (`SET NULL`, so deleting a parent never deletes its children), backfills the old `seriesName` strings into real series rows, and drops the cover columns from comic publishers, universes and titles. |
| `005-anime-hierarchy.sql` | Gives anime the same Universe → Series → Season hierarchy as TV, with real foreign keys (`SET NULL`) and a backfill of the old `seriesName` strings. Leaves `Anime.season` — the *airing* season enum — alone. |
| `006-book-hierarchy.sql` | Gives books a Universe → Series → Book hierarchy (`SET NULL`). No backfill: books never had a `seriesName`, so every existing book stays standalone until it is filed by hand. |
| `007-movie-universes.sql` | Gives movies a Universe → Movie hierarchy (`SET NULL`). Two levels only — there is no series tier for films. No backfill. |
| `008-drop-series-name.sql` | Drops the legacy `seriesName` strings from `TvShow` and `Anime`, superseded by the real series foreign keys in 004/005. **Run order is reversed for this one — deploy the code that no longer references the column FIRST, then run this.** Aborts without changing anything if any row still has a `seriesName` but no `seriesId`. |
| `009-season-number.sql` | Adds `seasonNumber` to `TvShow` and `Anime` so a season is picked rather than typed into the title, plus the `(seriesId, seasonNumber)` ordering index. Additive — run **before** the deploy. |
| `010-dry-run-season-from-title.sql` | **Read-only.** Proposes a season number and stripped title for every existing entry whose title looks season-suffixed, and flags the ambiguous ones. Review its output before any backfill is written. |
| `003-derived-status.sql` | Removes DROPPED/ON_HOLD/DNF, adds `Book.pagesRead` and `Manga.ongoing`, and backfills every status from its progress counts. Aborts without changing anything if a removed value is still in use. |
| `002-expense-idempotency.sql` | Adds a unique `Expense.clientId` so the offline expense logger can retry without creating duplicate expenses. |

## How 001 was verified

Rather than trusting it by inspection, it was run against a throwaway PostgreSQL 16
instance seeded to match the production schema, and checked for:

- a clean first run, and a second run that is a complete no-op (idempotency)
- `ON DELETE CASCADE` actually removing issues when their publisher is deleted
- the `(titleId, issueNumber)` unique constraint rejecting a duplicate issue
- `issueNumber` ordering numerically (`#0 #1 #1.5 #2 #10`, not string order)
- `prisma migrate diff` reporting **no** residual drift for any table it touches

## How 004–007 were verified

Same bar as 001, against a throwaway PostgreSQL 16 pushed to the previous schema:

- clean first run, second run a complete no-op
- `prisma migrate diff` reporting an **empty** migration against `schema.prisma`
- the `seriesName` backfill collapsing rows that shared a name into one series, while
  rows with a NULL or empty name stayed standalone
- deleting a universe leaving its series intact, and deleting a series leaving its
  seasons intact (`SET NULL`, verified as `confdeltype = 'n'` on both foreign keys)
- every season reachable through exactly one path, and a series inside a universe
  absent from the section's main page
- `Anime.season` still typed `AnimeSeason` afterwards
