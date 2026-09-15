-- Phase 2: anime gains a Universe → Series → Season hierarchy, mirroring TV.
--
-- Anime had the same broken grouping TV did — `Anime.seriesName` was a bare string with no
-- foreign key and AnimeSeries was a registry nothing joined to. Unlike TV, anime never had a
-- UI for it (the components were unimported and dead), so seriesName is probably all NULL.
-- The backfill runs either way.
--
-- Deletes are ON DELETE SET NULL, never CASCADE: removing a universe must not remove the
-- anime inside it.
--
-- Note: `Anime.season` is the AIRING season (WINTER/SPRING/SUMMER/FALL) and is deliberately
-- untouched — it has nothing to do with the season-of-a-series concept added here.
--
-- Idempotent: safe to run again.

BEGIN;

-- ─── 1. AnimeUniverse ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "AnimeUniverse" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "notes"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnimeUniverse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AnimeUniverse_name_key" ON "AnimeUniverse"("name");

-- ─── 2. AnimeSeries becomes a real model ─────────────────────────────────────
-- Extend rather than recreate, so any names already registered survive.
ALTER TABLE "AnimeSeries" ADD COLUMN IF NOT EXISTS "universeId" TEXT;
ALTER TABLE "AnimeSeries" ADD COLUMN IF NOT EXISTS "notes"      TEXT;
ALTER TABLE "AnimeSeries" ADD COLUMN IF NOT EXISTS "updatedAt"  TIMESTAMP(3);
UPDATE "AnimeSeries" SET "updatedAt" = COALESCE("updatedAt", "createdAt", now()) WHERE "updatedAt" IS NULL;
ALTER TABLE "AnimeSeries" ALTER COLUMN "updatedAt" SET NOT NULL;

-- Name is unique per universe now, not globally.
DROP INDEX IF EXISTS "AnimeSeries_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "AnimeSeries_universeId_name_key" ON "AnimeSeries"("universeId", "name");
CREATE INDEX IF NOT EXISTS "AnimeSeries_universeId_idx" ON "AnimeSeries"("universeId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AnimeSeries_universeId_fkey') THEN
    ALTER TABLE "AnimeSeries" ADD CONSTRAINT "AnimeSeries_universeId_fkey"
      FOREIGN KEY ("universeId") REFERENCES "AnimeUniverse"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── 3. Anime points at a series ─────────────────────────────────────────────
ALTER TABLE "Anime" ADD COLUMN IF NOT EXISTS "seriesId" TEXT;
CREATE INDEX IF NOT EXISTS "Anime_seriesId_idx" ON "Anime"("seriesId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Anime_seriesId_fkey') THEN
    ALTER TABLE "Anime" ADD CONSTRAINT "Anime_seriesId_fkey"
      FOREIGN KEY ("seriesId") REFERENCES "AnimeSeries"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── 4. Backfill: existing seriesName strings become real series rows ────────
INSERT INTO "AnimeSeries" ("id", "name", "createdAt", "updatedAt")
SELECT 'ans_' || substr(md5(s."seriesName"), 1, 21), s."seriesName", now(), now()
FROM (SELECT DISTINCT "seriesName" FROM "Anime" WHERE "seriesName" IS NOT NULL AND "seriesName" <> '') s
WHERE NOT EXISTS (
  SELECT 1 FROM "AnimeSeries" a WHERE a."name" = s."seriesName" AND a."universeId" IS NULL
);

UPDATE "Anime" an
SET "seriesId" = a."id"
FROM "AnimeSeries" a
WHERE an."seriesName" IS NOT NULL
  AND an."seriesName" <> ''
  AND a."name" = an."seriesName"
  AND a."universeId" IS NULL
  AND an."seriesId" IS DISTINCT FROM a."id";

COMMIT;
