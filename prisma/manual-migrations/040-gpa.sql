-- Study: the GPA sheet. One row per lesson, with weekly hours and the marks for each half
-- of the year (two exams, two performances, a project). Averages are worked out in the app,
-- so this table only holds what was typed.
--
-- ADDITIVE: creates one new table and touches nothing else. Run BEFORE (or right as) the
-- deploy — saving grades waits for it; the GPA page still opens and says so.
--
-- Idempotent: safe to run again.

BEGIN;

CREATE TABLE IF NOT EXISTS "GpaLesson" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "hours"     DOUBLE PRECISION NOT NULL,
  "position"  INTEGER NOT NULL,
  "h1Exam1"   DOUBLE PRECISION,
  "h1Perf1"   DOUBLE PRECISION,
  "h1Exam2"   DOUBLE PRECISION,
  "h1Perf2"   DOUBLE PRECISION,
  "h1Project" DOUBLE PRECISION,
  "h2Exam1"   DOUBLE PRECISION,
  "h2Perf1"   DOUBLE PRECISION,
  "h2Exam2"   DOUBLE PRECISION,
  "h2Perf2"   DOUBLE PRECISION,
  "h2Project" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GpaLesson_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GpaLesson_position_idx" ON "GpaLesson"("position");

-- ─── Row level security ──────────────────────────────────────────────────────
-- As with every other public table: keeps it out of Supabase's REST API for the anon key.
ALTER TABLE "GpaLesson" ENABLE ROW LEVEL SECURITY;

COMMIT;
