-- A Kindle copy, separate from the physical one already stored in Book.owned.
--
-- ADDITIVE: one boolean, default false, so every book you already own stays a physical
-- copy and nothing is marked Kindle until you say so. Run it BEFORE (or right as) the
-- deploy — the book pages read this column and error until it has run.
--
-- Idempotent: safe to run again.

BEGIN;

ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "ownedKindle" BOOLEAN NOT NULL DEFAULT false;

COMMIT;
