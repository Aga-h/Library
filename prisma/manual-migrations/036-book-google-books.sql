-- Google Books as the second book catalogue.
--
-- Open Library is still the work-level id; Google Books is edition-centric, so the same novel
-- can be many volumes. Search collapses those by title + author, and a book remembers at most
-- one volume id so importing it again, or "Check catalogues" on its page, lands on the same
-- row and only fills in what is missing. Books added by hand leave it null.
--
-- ADDITIVE: one nullable column and one unique index. Run it BEFORE (or right as) the deploy —
-- the new code reads this column, so the book pages error until it has run. 035
-- (openLibraryId) should already have run; this script does not depend on it.
--
-- Idempotent: safe to run again.

BEGIN;

ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "googleBooksId" TEXT;

-- A volume is in the library once. NULLs are distinct in Postgres, so books added by hand
-- never collide with each other here.
CREATE UNIQUE INDEX IF NOT EXISTS "Book_googleBooksId_key" ON "Book"("googleBooksId");

COMMIT;
