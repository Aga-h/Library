-- Importing TV shows from TMDB.
--
-- A series imported from TMDB remembers its TMDB id, so importing the show again — or "Check for
-- new seasons" on its page — lands on the same series and only adds what is missing. It also keeps
-- the IMDb id TMDB reports, used to link to the show's IMDb page. Series made by hand leave both
-- null. Seasons need nothing new: a season is its series plus its season number.
--
-- ADDITIVE: two nullable columns and one unique index. Run it BEFORE (or right as) the deploy —
-- the new code reads these columns, so the TV pages error until it has run.
--
-- Idempotent: safe to run again.

BEGIN;

ALTER TABLE "TvSeries" ADD COLUMN IF NOT EXISTS "tmdbId" INTEGER;
ALTER TABLE "TvSeries" ADD COLUMN IF NOT EXISTS "imdbId" TEXT;

-- A show is in the library once. NULLs are distinct in Postgres, so series made by hand never
-- collide with each other here.
CREATE UNIQUE INDEX IF NOT EXISTS "TvSeries_tmdbId_key" ON "TvSeries"("tmdbId");

COMMIT;
