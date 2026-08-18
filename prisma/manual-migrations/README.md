# Manual migrations

`prisma db push` cannot reach this project's Supabase instance from the usual dev
environments (the pooled connection rejects DDL, and the direct host is not always
reachable), so schema changes are applied by pasting these scripts into the
**Supabase → SQL Editor**.

Every script here is **idempotent** — safe to run again if you are unsure whether it
already went through.

Apply them in filename order, then run `npx prisma generate` locally so the client
types match.

| Script | What it does |
|---|---|
| `001-comics-hierarchy-and-indexes.sql` | Replaces the flat `Comic` table with the Publisher → Universe → Title → Issue hierarchy, adds `Subscription`, and applies the index tuning from the repo audit. |

## How 001 was verified

Rather than trusting it by inspection, it was run against a throwaway PostgreSQL 16
instance seeded to match the production schema, and checked for:

- a clean first run, and a second run that is a complete no-op (idempotency)
- `ON DELETE CASCADE` actually removing issues when their publisher is deleted
- the `(titleId, issueNumber)` unique constraint rejecting a duplicate issue
- `issueNumber` ordering numerically (`#0 #1 #1.5 #2 #10`, not string order)
- `prisma migrate diff` reporting **no** residual drift for any table it touches
