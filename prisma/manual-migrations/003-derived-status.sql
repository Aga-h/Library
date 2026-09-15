-- Status becomes derived from progress counts instead of being chosen by hand.
--
-- Three parts:
--   1. A guard. DROPPED / ON_HOLD / DNF are being removed. If any row still uses one this
--      raises and the whole transaction rolls back, changing nothing — far better than
--      silently reassigning items you cared about.
--   2. New progress fields: Book.pagesRead (books had none) and Manga.ongoing ("still
--      releasing", which can never be Completed).
--   3. Enum rebuilds. Postgres cannot drop a value from an enum, so each type is renamed,
--      recreated without the dead values, and the column converted across.
--
-- Ends with a backfill so existing rows match the new rule straight away rather than staying
-- stale until each one happens to be edited.
--
-- Idempotent: safe to run again.

BEGIN;

-- ─── 1. Guard ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "TvShow" WHERE status::text IN ('DROPPED','ON_HOLD'))
  OR EXISTS (SELECT 1 FROM "Anime"  WHERE status::text IN ('DROPPED','ON_HOLD'))
  OR EXISTS (SELECT 1 FROM "Manga"  WHERE status::text IN ('DROPPED','ON_HOLD'))
  OR EXISTS (SELECT 1 FROM "Book"   WHERE status::text = 'DNF')
  THEN
    RAISE EXCEPTION
      'Some rows still use DROPPED / ON_HOLD / DNF. Nothing has been changed. Reassign them first, then re-run.';
  END IF;
END $$;

-- ─── 2. New progress fields ──────────────────────────────────────────────────
ALTER TABLE "Book"  ADD COLUMN IF NOT EXISTS "pagesRead" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Manga" ADD COLUMN IF NOT EXISTS "ongoing"   BOOLEAN NOT NULL DEFAULT false;

-- ─── 3. Rebuild the enums without the removed values ─────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
             WHERE t.typname = 'BookStatus' AND e.enumlabel = 'DNF') THEN
    ALTER TYPE "BookStatus" RENAME TO "BookStatus_old";
    CREATE TYPE "BookStatus" AS ENUM ('READ','READING','WANT_TO_READ');
    ALTER TABLE "Book" ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE "Book" ALTER COLUMN status TYPE "BookStatus" USING status::text::"BookStatus";
    ALTER TABLE "Book" ALTER COLUMN status SET DEFAULT 'WANT_TO_READ';
    DROP TYPE "BookStatus_old";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
             WHERE t.typname = 'AnimeStatus' AND e.enumlabel = 'DROPPED') THEN
    ALTER TYPE "AnimeStatus" RENAME TO "AnimeStatus_old";
    CREATE TYPE "AnimeStatus" AS ENUM ('WATCHING','COMPLETED','PLAN_TO_WATCH');
    ALTER TABLE "Anime" ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE "Anime" ALTER COLUMN status TYPE "AnimeStatus" USING status::text::"AnimeStatus";
    ALTER TABLE "Anime" ALTER COLUMN status SET DEFAULT 'PLAN_TO_WATCH';
    DROP TYPE "AnimeStatus_old";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
             WHERE t.typname = 'TvStatus' AND e.enumlabel = 'DROPPED') THEN
    ALTER TYPE "TvStatus" RENAME TO "TvStatus_old";
    CREATE TYPE "TvStatus" AS ENUM ('WATCHING','COMPLETED','PLAN_TO_WATCH');
    ALTER TABLE "TvShow" ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE "TvShow" ALTER COLUMN status TYPE "TvStatus" USING status::text::"TvStatus";
    ALTER TABLE "TvShow" ALTER COLUMN status SET DEFAULT 'PLAN_TO_WATCH';
    DROP TYPE "TvStatus_old";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
             WHERE t.typname = 'MangaStatus' AND e.enumlabel = 'DROPPED') THEN
    ALTER TYPE "MangaStatus" RENAME TO "MangaStatus_old";
    CREATE TYPE "MangaStatus" AS ENUM ('READING','COMPLETED','PLAN_TO_READ');
    ALTER TABLE "Manga" ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE "Manga" ALTER COLUMN status TYPE "MangaStatus" USING status::text::"MangaStatus";
    ALTER TABLE "Manga" ALTER COLUMN status SET DEFAULT 'PLAN_TO_READ';
    DROP TYPE "MangaStatus_old";
  END IF;
END $$;

-- ─── 4. Backfill so existing rows match the new rule immediately ─────────────
-- Books: pagesRead starts at 0, so anything already marked READ is treated as fully read
-- rather than being demoted to "want to read".
UPDATE "Book" SET "pagesRead" = "pages" WHERE status = 'READ' AND "pagesRead" = 0;

UPDATE "Book" SET status = CASE
  WHEN "pages" > 0 AND "pagesRead" >= "pages" THEN 'READ'::"BookStatus"
  WHEN "pagesRead" > 0                        THEN 'READING'::"BookStatus"
  ELSE 'WANT_TO_READ'::"BookStatus" END;

UPDATE "Anime" SET status = CASE
  WHEN "episodes" IS NOT NULL AND "episodes" > 0 AND "episodesWatched" >= "episodes"
       THEN 'COMPLETED'::"AnimeStatus"
  WHEN "episodesWatched" > 0 THEN 'WATCHING'::"AnimeStatus"
  ELSE 'PLAN_TO_WATCH'::"AnimeStatus" END;

UPDATE "TvShow" SET status = CASE
  WHEN "totalEpisodes" IS NOT NULL AND "totalEpisodes" > 0 AND "episodesWatched" >= "totalEpisodes"
       THEN 'COMPLETED'::"TvStatus"
  WHEN "episodesWatched" > 0 THEN 'WATCHING'::"TvStatus"
  ELSE 'PLAN_TO_WATCH'::"TvStatus" END;

-- Manga mirrors lib/derive-status.ts: chapters lead, volumes fall back, ongoing never completes.
UPDATE "Manga" SET status = CASE
  WHEN "ongoing" THEN
    CASE WHEN COALESCE(NULLIF("chaptersRead",0), "volumesRead") > 0
         THEN 'READING'::"MangaStatus" ELSE 'PLAN_TO_READ'::"MangaStatus" END
  WHEN "totalChapters" IS NOT NULL AND "totalChapters" > 0 THEN
    CASE WHEN "chaptersRead" >= "totalChapters" THEN 'COMPLETED'::"MangaStatus"
         WHEN "chaptersRead" > 0                THEN 'READING'::"MangaStatus"
         ELSE 'PLAN_TO_READ'::"MangaStatus" END
  WHEN "totalVolumes" IS NOT NULL AND "totalVolumes" > 0 THEN
    CASE WHEN "volumesRead" >= "totalVolumes" THEN 'COMPLETED'::"MangaStatus"
         WHEN "volumesRead" > 0               THEN 'READING'::"MangaStatus"
         ELSE 'PLAN_TO_READ'::"MangaStatus" END
  ELSE
    CASE WHEN COALESCE(NULLIF("chaptersRead",0), "volumesRead") > 0
         THEN 'READING'::"MangaStatus" ELSE 'PLAN_TO_READ'::"MangaStatus" END
END;

COMMIT;
