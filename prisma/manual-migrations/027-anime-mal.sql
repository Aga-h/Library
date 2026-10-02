-- Importing anime from MyAnimeList.
--
-- On MyAnimeList every season, film and OVA is its own entry, so the link lives on the row: an
-- anime imported from MAL remembers its MAL id, and importing it again — or "Check for new
-- seasons" on its series — lands on the same row and only adds what is missing. Anime added by
-- hand leave it null.
--
-- ADDITIVE: one nullable column and one unique index. Run it BEFORE (or right as) the deploy —
-- the new code reads this column, so the anime pages error until it has run.
--
-- Idempotent: safe to run again.

BEGIN;

ALTER TABLE "Anime" ADD COLUMN IF NOT EXISTS "malId" INTEGER;

-- An entry is in the library once. NULLs are distinct in Postgres, so anime added by hand never
-- collide with each other here.
CREATE UNIQUE INDEX IF NOT EXISTS "Anime_malId_key" ON "Anime"("malId");

COMMIT;
