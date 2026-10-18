-- Importing books from Open Library.
--
-- A work on Open Library is the book itself (every paperback of one novel is the same work),
-- so a book imported from Open Library remembers its work id: importing it again, or "Check
-- Open Library" on its page, lands on the same row and only fills in what is missing. Books
-- added by hand leave it null.
--
-- ADDITIVE: one nullable column and one unique index. Run it BEFORE (or right as) the deploy —
-- the new code reads this column, so the book pages error until it has run.
--
-- Idempotent: safe to run again.

BEGIN;

ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "openLibraryId" TEXT;

-- A work is in the library once. NULLs are distinct in Postgres, so books added by hand never
-- collide with each other here.
CREATE UNIQUE INDEX IF NOT EXISTS "Book_openLibraryId_key" ON "Book"("openLibraryId");

COMMIT;
