-- Fills in `seasonNumber` for the entries whose title already ends in "| Season N".
--
-- Reviewed against the real library first (010's dry run): 16 rows matched, all of them the
-- safe "Season N" pattern, and no bare-number or roman-numeral false positives at all. The two
-- genuinely standalone entries — "Akame ga Kill" and "Sentenced to Be a Hero" — matched
-- nothing and are left untouched.
--
-- TITLES ARE NOT STRIPPED. "Supernatural | Season 3" stays exactly as it is: that format is
-- deliberate, and the app now writes new seasons the same way. This migration only fills in
-- the structured number beside it, which is what sorts the seasons and draws the badge.
--
-- The one title change is trailing whitespace: "Supernatural | Season 4 " has a trailing space,
-- which is precisely why the dry run reported it as "left alone" while its seven siblings
-- matched. Trimming it is what lets it join them.
--
-- Idempotent: only touches rows where seasonNumber IS NULL, so a re-run is a no-op.

BEGIN;

-- 1. Trailing whitespace, so anchored matches are not defeated by an invisible character.
UPDATE "TvShow" SET title = rtrim(title) WHERE title <> rtrim(title);
UPDATE "Anime"  SET title = rtrim(title) WHERE title <> rtrim(title);

-- 2. The number itself. Case-insensitive, and tolerant of the pipe being present or not.
UPDATE "TvShow"
SET "seasonNumber" = (regexp_match(title, '\sSeason\s+(\d{1,2})$', 'i'))[1]::int
WHERE "seasonNumber" IS NULL
  AND title ~* '\sSeason\s+\d{1,2}$'
  AND (regexp_match(title, '\sSeason\s+(\d{1,2})$', 'i'))[1]::int >= 1;

UPDATE "Anime"
SET "seasonNumber" = (regexp_match(title, '\sSeason\s+(\d{1,2})$', 'i'))[1]::int
WHERE "seasonNumber" IS NULL
  AND title ~* '\sSeason\s+\d{1,2}$'
  AND (regexp_match(title, '\sSeason\s+(\d{1,2})$', 'i'))[1]::int >= 1;

COMMIT;
