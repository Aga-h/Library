-- Self Care → Diet: a meal can be skipped ("didn't / won't eat it") as well as eaten, and what was
-- eaten on top of it (bread, a dessert) is kept with it. The rest of the day rebalances around
-- both; an eaten meal keeps the add-ons and trims it was eaten with.
--
-- ADDITIVE: three columns on "MealCheck", with defaults that make every existing row what it
-- already meant — eaten as planned. Plain ticks keep working before this has run; skipping a meal
-- and logging extras wait for it.
--
-- Idempotent: safe to run again.

BEGIN;

-- "status" is 'ate' or 'skipped'; the API checks it, as it checks every other value.
ALTER TABLE "MealCheck" ADD COLUMN IF NOT EXISTS "status"  TEXT   NOT NULL DEFAULT 'ate';
-- Nullable like every Prisma list column, so the schema and the database agree exactly.
ALTER TABLE "MealCheck" ADD COLUMN IF NOT EXISTS "changes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "MealCheck" ADD COLUMN IF NOT EXISTS "extras"  JSONB  NOT NULL DEFAULT '[]';

COMMIT;
