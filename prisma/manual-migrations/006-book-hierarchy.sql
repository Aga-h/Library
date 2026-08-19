-- Phase 3: books gain a Universe → Series → Book hierarchy, mirroring anime and TV.
--
-- Unlike TV and anime, books never had a `seriesName` string, so there is nothing to
-- backfill — every existing book simply stays standalone until it is filed by hand.
--
-- Deletes are ON DELETE SET NULL, never CASCADE: removing a universe or a series
-- regroups the books inside it, it never deletes them.
--
-- Idempotent: safe to run again.

BEGIN;

-- ─── 1. BookUniverse ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BookUniverse" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "notes"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookUniverse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BookUniverse_name_key" ON "BookUniverse"("name");

-- ─── 2. BookSeries ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BookSeries" (
  "id"         TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "universeId" TEXT,
  "notes"      TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookSeries_pkey" PRIMARY KEY ("id")
);
-- Name is unique per universe, not globally: two universes may each have a "Legends".
CREATE UNIQUE INDEX IF NOT EXISTS "BookSeries_universeId_name_key" ON "BookSeries"("universeId", "name");
CREATE INDEX IF NOT EXISTS "BookSeries_universeId_idx" ON "BookSeries"("universeId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookSeries_universeId_fkey') THEN
    ALTER TABLE "BookSeries" ADD CONSTRAINT "BookSeries_universeId_fkey"
      FOREIGN KEY ("universeId") REFERENCES "BookUniverse"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── 3. Book points at a series ──────────────────────────────────────────────
ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "seriesId" TEXT;
CREATE INDEX IF NOT EXISTS "Book_seriesId_idx" ON "Book"("seriesId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Book_seriesId_fkey') THEN
    ALTER TABLE "Book" ADD CONSTRAINT "Book_seriesId_fkey"
      FOREIGN KEY ("seriesId") REFERENCES "BookSeries"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
