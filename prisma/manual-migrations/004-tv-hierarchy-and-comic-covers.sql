-- Phase 1: TV gains a Universe → Series → Season hierarchy, and comic publishers,
-- universes and comic titles lose their cover images (only issues keep artwork).
--
-- TV grouping was a bare `TvShow.seriesName` string with no foreign key — the TvSeries
-- table was a name registry nothing joined to, so renaming or deleting a series silently
-- orphaned its seasons. This replaces it with real relations and backfills the existing
-- grouping so nothing you already organised is lost.
--
-- Deletes use ON DELETE SET NULL, never CASCADE: removing a universe must not remove the
-- shows inside it. That is the opposite of the comics tree, where a parent genuinely owns
-- its children.
--
-- Idempotent: safe to run again.

BEGIN;

-- ─── 1. Comic parent covers ──────────────────────────────────────────────────
ALTER TABLE "ComicPublisher" DROP COLUMN IF EXISTS "coverImage";
ALTER TABLE "ComicUniverse"  DROP COLUMN IF EXISTS "coverImage";
ALTER TABLE "ComicTitle"     DROP COLUMN IF EXISTS "coverImage";

-- ─── 2. TvUniverse ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "TvUniverse" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "notes"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TvUniverse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TvUniverse_name_key" ON "TvUniverse"("name");

-- ─── 3. TvSeries becomes a real model ────────────────────────────────────────
-- The old table was (id, name UNIQUE, createdAt). Extend it rather than recreate, so any
-- series names already registered survive.
ALTER TABLE "TvSeries" ADD COLUMN IF NOT EXISTS "universeId" TEXT;
ALTER TABLE "TvSeries" ADD COLUMN IF NOT EXISTS "notes"      TEXT;
ALTER TABLE "TvSeries" ADD COLUMN IF NOT EXISTS "updatedAt"  TIMESTAMP(3);
UPDATE "TvSeries" SET "updatedAt" = COALESCE("updatedAt", "createdAt", now()) WHERE "updatedAt" IS NULL;
ALTER TABLE "TvSeries" ALTER COLUMN "updatedAt" SET NOT NULL;

-- Name is unique per universe now, not globally.
DROP INDEX IF EXISTS "TvSeries_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "TvSeries_universeId_name_key" ON "TvSeries"("universeId", "name");
CREATE INDEX IF NOT EXISTS "TvSeries_universeId_idx" ON "TvSeries"("universeId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TvSeries_universeId_fkey') THEN
    ALTER TABLE "TvSeries" ADD CONSTRAINT "TvSeries_universeId_fkey"
      FOREIGN KEY ("universeId") REFERENCES "TvUniverse"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── 4. TvShow points at a series ────────────────────────────────────────────
ALTER TABLE "TvShow" ADD COLUMN IF NOT EXISTS "seriesId" TEXT;
CREATE INDEX IF NOT EXISTS "TvShow_seriesId_idx" ON "TvShow"("seriesId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TvShow_seriesId_fkey') THEN
    ALTER TABLE "TvShow" ADD CONSTRAINT "TvShow_seriesId_fkey"
      FOREIGN KEY ("seriesId") REFERENCES "TvSeries"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── 5. Backfill: existing seriesName strings become real series rows ─────────
-- Every distinct name in use gets a universe-less TvSeries row, then the shows are linked.
INSERT INTO "TvSeries" ("id", "name", "createdAt", "updatedAt")
SELECT
  'tvs_' || substr(md5(s."seriesName"), 1, 21),
  s."seriesName",
  now(),
  now()
FROM (SELECT DISTINCT "seriesName" FROM "TvShow" WHERE "seriesName" IS NOT NULL AND "seriesName" <> '') s
WHERE NOT EXISTS (
  SELECT 1 FROM "TvSeries" t WHERE t."name" = s."seriesName" AND t."universeId" IS NULL
);

UPDATE "TvShow" sh
SET "seriesId" = t."id"
FROM "TvSeries" t
WHERE sh."seriesName" IS NOT NULL
  AND sh."seriesName" <> ''
  AND t."name" = sh."seriesName"
  AND t."universeId" IS NULL
  AND sh."seriesId" IS DISTINCT FROM t."id";

COMMIT;
