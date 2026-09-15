-- Drops the legacy `seriesName` strings from TvShow and Anime.
--
-- 004 and 005 converted these into real TvSeries / AnimeSeries rows and linked them by
-- foreign key. They have been kept one release as the only surviving copy of the original
-- grouping text, in case the backfill turned out wrong. It did not, so they go.
--
-- ── RUN ORDER IS THE REVERSE OF EVERY MIGRATION BEFORE THIS ONE ──────────────
-- 002 to 007 ADDED things, so the SQL had to run BEFORE the code that used them.
-- This one REMOVES things, so the code that stopped referencing them must be deployed
-- FIRST. Prisma names every column explicitly in its SELECTs, so dropping a column the
-- deployed schema still declares breaks every read of that table.
--
--   deploy the code that no longer mentions seriesName  →  THEN run this
--
-- Running it early is what would break TV and anime; running it late breaks nothing.
--
-- Idempotent: safe to run again. Aborts without changing anything if any row would lose
-- grouping information.

BEGIN;

-- ─── Safety guard ────────────────────────────────────────────────────────────
-- A row with a name but no series means the backfill never covered it, and dropping the
-- column would destroy the only record of where it belonged. Refuse rather than lose it.
--
-- The counts run through EXECUTE, and only when the column is still present: PL/pgSQL
-- resolves column names when a statement is planned, so a static query here would throw
-- "column does not exist" on the second run instead of quietly finding nothing to do.
DO $$
DECLARE
  stranded_tv    INTEGER := 0;
  stranded_anime INTEGER := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'TvShow'
               AND column_name = 'seriesName') THEN
    EXECUTE 'SELECT count(*) FROM "TvShow"
             WHERE "seriesName" IS NOT NULL AND "seriesName" <> '''' AND "seriesId" IS NULL'
      INTO stranded_tv;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'Anime'
               AND column_name = 'seriesName') THEN
    EXECUTE 'SELECT count(*) FROM "Anime"
             WHERE "seriesName" IS NOT NULL AND "seriesName" <> '''' AND "seriesId" IS NULL'
      INTO stranded_anime;
  END IF;

  IF stranded_tv > 0 OR stranded_anime > 0 THEN
    RAISE EXCEPTION
      'Aborting: % TV show(s) and % anime still carry a seriesName but no seriesId. '
      'Re-run 004 and 005 to finish the backfill, then run this again. Nothing was changed.',
      stranded_tv, stranded_anime;
  END IF;
END $$;

-- ─── Drop ────────────────────────────────────────────────────────────────────
ALTER TABLE "TvShow" DROP COLUMN IF EXISTS "seriesName";
ALTER TABLE "Anime"  DROP COLUMN IF EXISTS "seriesName";

COMMIT;
