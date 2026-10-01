-- Comics no longer record a writer, an artist or a release date.
--
-- Drops ComicTitle.author, ComicTitle.artist and ComicIssue.releaseDate.
--
-- DESTRUCTIVE: whatever was stored in those three columns is deleted and cannot be recovered from
-- the app. Take a Supabase backup first if you might want it back. To see what is there before
-- you drop it:
--
--   SELECT count(*) FILTER (WHERE "author" IS NOT NULL) AS writers,
--          count(*) FILTER (WHERE "artist" IS NOT NULL) AS artists
--   FROM "ComicTitle";
--   SELECT count(*) FILTER (WHERE "releaseDate" IS NOT NULL) AS dated_issues FROM "ComicIssue";
--
-- OPTIONAL, and a REMOVAL: run it only AFTER the deploy carrying this change is live — the code
-- deployed before it still reads these columns. Nothing breaks if it is never run: all three are
-- nullable and the new code never touches them, so they would just sit there unused.
--
-- Idempotent: safe to run again.

BEGIN;

ALTER TABLE "ComicTitle" DROP COLUMN IF EXISTS "author";
ALTER TABLE "ComicTitle" DROP COLUMN IF EXISTS "artist";
ALTER TABLE "ComicIssue" DROP COLUMN IF EXISTS "releaseDate";

COMMIT;
