-- TV shows and anime record which season of their series they are.
--
-- Until now the season lived in free text at the end of the title ("DS9 S1"), so it had to be
-- retyped by hand and could not be sorted on — the seasons inside a series were ordered by
-- when they were entered, and only looked right by luck.
--
-- Note: `Anime.season` already exists and is the AIRING season (WINTER/SPRING/SUMMER/FALL).
-- It is a different thing and is deliberately untouched. Hence `seasonNumber`.
--
-- ADDITIVE, so the usual order applies: run this BEFORE deploying the code that uses it.
-- (Only removals run after the deploy — see the direction note at the top of the README.)
--
-- No backfill here. Parsing the season out of existing titles is migration 010, after the
-- dry run has been reviewed, so this column can ship without waiting on that judgement.
--
-- Idempotent: safe to run again.

BEGIN;

ALTER TABLE "TvShow" ADD COLUMN IF NOT EXISTS "seasonNumber" INTEGER;
ALTER TABLE "Anime"  ADD COLUMN IF NOT EXISTS "seasonNumber" INTEGER;

-- Serves the ordering query on a series page. Not UNIQUE: `seriesId` is nullable, so a unique
-- would let unrelated standalone rows collide on NULL while still failing to stop two
-- "Season 1"s inside one series.
CREATE INDEX IF NOT EXISTS "TvShow_seriesId_seasonNumber_idx" ON "TvShow"("seriesId", "seasonNumber");
CREATE INDEX IF NOT EXISTS "Anime_seriesId_seasonNumber_idx"  ON "Anime"("seriesId", "seasonNumber");

COMMIT;
