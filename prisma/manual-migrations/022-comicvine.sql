-- Importing comics from Comic Vine.
--
-- A comic imported from Comic Vine remembers which Comic Vine volume (run) it came from, so
-- importing the same run again fills in new issues instead of creating a second copy. Comics added
-- by hand leave it null.
--
-- ADDITIVE: one nullable column and one unique index. Run it BEFORE the deploy.
--
-- Idempotent: safe to run again.

BEGIN;

ALTER TABLE "ComicTitle" ADD COLUMN IF NOT EXISTS "comicVineId" INTEGER;

-- One copy of a run per universe. NULLs are distinct in Postgres, so hand-added comics never
-- collide with each other here.
CREATE UNIQUE INDEX IF NOT EXISTS "ComicTitle_universeId_comicVineId_key"
  ON "ComicTitle"("universeId", "comicVineId");

COMMIT;
