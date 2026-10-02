-- OPTIONAL: clearing out the anime logged by hand, so the library can be rebuilt from MyAnimeList.
--
-- Movies and TV were cleared this way at the user's request. For anime the user said "the same",
-- so this is offered rather than assumed: skip it to keep what is there — an import then matches
-- your entries by title and year, ties them to MyAnimeList, and only fills in blanks.
--
-- Deletes EVERY anime entry, EVERY anime series and EVERY anime universe.
--
-- DESTRUCTIVE and ONE-TIME, but guarded: if anything has already been imported from MyAnimeList it
-- does nothing at all, so running it again later can never wipe the rebuilt library. Run it
-- BEFORE importing anything.
--
-- Needs 027 first (it reads "malId").
--
-- The last statement prints what is left: 0 / 0 / 0 / 0 means it ran; non-zero counts with
-- imported_from_mal > 0 mean it was skipped.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Anime" WHERE "malId" IS NOT NULL) THEN
    RAISE NOTICE 'Skipped: anime have already been imported from MyAnimeList, so nothing was deleted.';
    RETURN;
  END IF;
  DELETE FROM "Anime";
  DELETE FROM "AnimeSeries";
  DELETE FROM "AnimeUniverse";
END $$;

SELECT
  (SELECT count(*) FROM "Anime")                         AS anime_left,
  (SELECT count(*) FROM "AnimeSeries")                   AS series_left,
  (SELECT count(*) FROM "AnimeUniverse")                 AS universes_left,
  (SELECT count(*) FROM "Anime" WHERE "malId" IS NOT NULL) AS imported_from_mal;
