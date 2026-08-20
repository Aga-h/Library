-- READ-ONLY. Changes nothing. Run this and read the output before any backfill exists.
--
-- Lists every TV show and anime whose title looks like it ends in a season, what the title
-- would become, and which pattern matched. Rows it would leave alone are listed too, so the
-- decision is visible from both sides.
--
-- The 'bare number' pattern is the dangerous one: "Stranger Things 4" and "Blake's 7" are
-- indistinguishable from a real suffix by shape alone. Check every row marked VERIFY. Anything
-- proposing season 0 (e.g. "Steins;Gate 0") is a false positive by definition -- seasons start
-- at 1 -- and the backfill will refuse it.
--
-- Once this output is approved, 011 does the actual write.

WITH rows_all AS (
  SELECT 'TvShow' AS tbl, id, title, "seasonNumber" FROM "TvShow"
  UNION ALL
  SELECT 'Anime',        id, title, "seasonNumber" FROM "Anime"
),
parsed AS (
  SELECT tbl, id, title, "seasonNumber",
    CASE
      WHEN title ~  '\sS0*\d{1,2}$'          THEN 'S-number'
      WHEN title ~* '\sSeason\s+\d{1,2}$'    THEN 'Season N'
      WHEN title ~  '\s(II|III|IV|V|VI|VII|VIII|IX|X)$' THEN 'roman'
      WHEN title ~  '\s\d{1,2}$'             THEN 'bare number  << CHECK ME'
    END AS pattern
  FROM rows_all
)
SELECT tbl, id, title AS current_title,
  CASE pattern
    WHEN 'S-number' THEN regexp_replace(title, '\sS0*\d{1,2}$', '')
    WHEN 'Season N' THEN regexp_replace(title, '\sSeason\s+\d{1,2}$', '', 'i')
    WHEN 'roman'    THEN regexp_replace(title, '\s(II|III|IV|V|VI|VII|VIII|IX|X)$', '')
    WHEN 'bare number  << CHECK ME' THEN regexp_replace(title, '\s\d{1,2}$', '')
  END AS proposed_title,
  CASE pattern
    WHEN 'S-number' THEN (regexp_match(title, '\sS0*(\d{1,2})$'))[1]::int
    WHEN 'Season N' THEN (regexp_match(title, '\sSeason\s+(\d{1,2})$', 'i'))[1]::int
    WHEN 'roman'    THEN CASE (regexp_match(title, '\s(II|III|IV|V|VI|VII|VIII|IX|X)$'))[1]
                           WHEN 'II' THEN 2 WHEN 'III' THEN 3 WHEN 'IV' THEN 4 WHEN 'V' THEN 5
                           WHEN 'VI' THEN 6 WHEN 'VII' THEN 7 WHEN 'VIII' THEN 8
                           WHEN 'IX' THEN 9 WHEN 'X' THEN 10 END
    WHEN 'bare number  << CHECK ME' THEN (regexp_match(title, '\s(\d{1,2})$'))[1]::int
  END AS proposed_season,
  coalesce(pattern, '— left alone —') AS pattern,
  CASE
    WHEN "seasonNumber" IS NOT NULL THEN 'skipped: already numbered'
    WHEN pattern = 'bare number  << CHECK ME' THEN 'VERIFY: is the number part of the name?'
  END AS note
FROM parsed
ORDER BY (pattern IS NULL), pattern, tbl, title;
