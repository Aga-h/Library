-- Study → GPA: a mark can be marked announced (the teacher's result) rather than a prediction.
-- "announced" holds the keys of those marks ("h1Exam1", "h2Project", …).
--
-- ADDITIVE: one column on "GpaLesson", empty by default, so every existing mark stays a
-- prediction. The GPA page keeps working before this has run; the announced checkboxes wait for it.
--
-- Idempotent: safe to run again.

BEGIN;

-- Nullable like every Prisma list column, so the schema and the database agree exactly.
ALTER TABLE "GpaLesson" ADD COLUMN IF NOT EXISTS "announced" TEXT[] DEFAULT ARRAY[]::TEXT[];

COMMIT;
