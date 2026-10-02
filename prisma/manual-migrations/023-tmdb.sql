-- Importing movies from TMDB.
--
-- A film imported from TMDB remembers its TMDB id, so importing it again (on its own, or as part
-- of a collection) lands on the same row and only fills in what is still blank. It also keeps the
-- IMDb id TMDB reports, which is used to link to the film's IMDb page. Films added by hand leave
-- both null.
--
-- ADDITIVE: two nullable columns and one unique index. Run it BEFORE (or right as) the deploy —
-- the new code reads these columns, so the movie pages error until it has run.
--
-- Idempotent: safe to run again.

BEGIN;

ALTER TABLE "Movie" ADD COLUMN IF NOT EXISTS "tmdbId" INTEGER;
ALTER TABLE "Movie" ADD COLUMN IF NOT EXISTS "imdbId" TEXT;

-- A film is in the library once. NULLs are distinct in Postgres, so films added by hand never
-- collide with each other here.
CREATE UNIQUE INDEX IF NOT EXISTS "Movie_tmdbId_key" ON "Movie"("tmdbId");

COMMIT;
