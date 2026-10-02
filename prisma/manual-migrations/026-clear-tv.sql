-- Clearing out the TV shows logged by hand, so the library can be rebuilt from TMDB.
--
-- Asked for on 2026-10-02: "first lets delete everything and then import". This deletes EVERY
-- season (TvShow), EVERY series and EVERY TV universe.
--
-- DESTRUCTIVE and ONE-TIME, but guarded: if any show has already been imported from TMDB it does
-- nothing at all. So running it again later, or by accident along with the other scripts, can
-- never wipe the rebuilt library. The flip side: run it BEFORE importing anything — once the
-- first show is imported, old entries have to be deleted from the site instead.
--
-- Needs 025 first (it reads "tmdbId").
--
-- The last statement prints what is left: 0 / 0 / 0 / 0 means it ran; non-zero counts with
-- imported_from_tmdb > 0 mean it was skipped.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "TvSeries" WHERE "tmdbId" IS NOT NULL) THEN
    RAISE NOTICE 'Skipped: shows have already been imported from TMDB, so nothing was deleted.';
    RETURN;
  END IF;
  DELETE FROM "TvShow";
  DELETE FROM "TvSeries";
  DELETE FROM "TvUniverse";
END $$;

SELECT
  (SELECT count(*) FROM "TvShow")                              AS seasons_left,
  (SELECT count(*) FROM "TvSeries")                            AS series_left,
  (SELECT count(*) FROM "TvUniverse")                          AS universes_left,
  (SELECT count(*) FROM "TvSeries" WHERE "tmdbId" IS NOT NULL) AS imported_from_tmdb;
