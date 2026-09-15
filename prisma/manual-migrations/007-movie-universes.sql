-- Phase 4: movies gain a Universe → Movie hierarchy.
--
-- Movies stop at two levels — there is no series tier. A franchise is the universe and
-- its films sit directly inside it, so a film is either in a universe or standalone.
--
-- No backfill: movies never carried a grouping string, so every existing film stays
-- standalone until it is filed by hand.
--
-- ON DELETE SET NULL, never CASCADE: deleting a universe returns its films to the main
-- page, it never deletes them.
--
-- Idempotent: safe to run again.

BEGIN;

-- ─── 1. MovieUniverse ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MovieUniverse" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "notes"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MovieUniverse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MovieUniverse_name_key" ON "MovieUniverse"("name");

-- ─── 2. Movie points at a universe ───────────────────────────────────────────
ALTER TABLE "Movie" ADD COLUMN IF NOT EXISTS "universeId" TEXT;
CREATE INDEX IF NOT EXISTS "Movie_universeId_idx" ON "Movie"("universeId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Movie_universeId_fkey') THEN
    ALTER TABLE "Movie" ADD CONSTRAINT "Movie_universeId_fkey"
      FOREIGN KEY ("universeId") REFERENCES "MovieUniverse"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
