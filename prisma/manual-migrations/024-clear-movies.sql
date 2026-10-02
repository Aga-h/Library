-- Clearing out the movies logged by hand, so the library can be rebuilt from TMDB.
--
-- Asked for on 2026-10-02: "you can delete the already existing universes and movies, I noted
-- them". This deletes EVERY movie and EVERY movie universe.
--
-- DESTRUCTIVE and ONE-TIME, but guarded: if anything has already been imported from TMDB it does
-- nothing at all. So running it again later, or by accident along with the other scripts, can
-- never wipe the rebuilt library. The flip side: run it BEFORE importing anything — once the
-- first film is imported, old entries have to be deleted from the site instead.
--
-- Needs 023 first (it reads "tmdbId").
--
-- The last statement prints what is left: 0 / 0 / 0 means it ran; non-zero counts with
-- imported_from_tmdb > 0 mean it was skipped.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Movie" WHERE "tmdbId" IS NOT NULL) THEN
    RAISE NOTICE 'Skipped: films have already been imported from TMDB, so nothing was deleted.';
    RETURN;
  END IF;
  DELETE FROM "Movie";
  DELETE FROM "MovieUniverse";
END $$;

SELECT
  (SELECT count(*) FROM "Movie")                            AS movies_left,
  (SELECT count(*) FROM "MovieUniverse")                    AS universes_left,
  (SELECT count(*) FROM "Movie" WHERE "tmdbId" IS NOT NULL) AS imported_from_tmdb;
