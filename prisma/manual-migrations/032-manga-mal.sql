-- Importing manga from MyAnimeList.
--
-- On MyAnimeList a manga is one entry for the whole series (volumes and chapters are counted
-- inside it), so a manga imported from MAL remembers its MAL id: importing it again, or "Check
-- MyAnimeList" on its page, lands on the same row and only fills in what is missing. Manga added
-- by hand leave it null.
--
-- ADDITIVE: one nullable column and one unique index. Run it BEFORE (or right as) the deploy —
-- the new code reads this column, so the manga pages error until it has run.
--
-- Idempotent: safe to run again.

BEGIN;

ALTER TABLE "Manga" ADD COLUMN IF NOT EXISTS "malId" INTEGER;

-- An entry is in the library once. NULLs are distinct in Postgres, so manga added by hand never
-- collide with each other here.
CREATE UNIQUE INDEX IF NOT EXISTS "Manga_malId_key" ON "Manga"("malId");

COMMIT;
