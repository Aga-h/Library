-- AP course unit tracker: the courses you are taking and the units in each.
--
-- Units mirror the official College Board Course and Exam Description for each course. This
-- migration creates the tables; 016 loads the unit lists, so a CED revision means a new data
-- migration rather than a schema change.
--
-- ADDITIVE: creates two new tables and touches nothing else. Run BEFORE deploying the code.
--
-- Idempotent: safe to run again.

BEGIN;

CREATE TABLE IF NOT EXISTS "ApCourse" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "shortName" TEXT NOT NULL,
  "position"  INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApCourse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ApCourse_name_key"     ON "ApCourse"("name");
CREATE INDEX        IF NOT EXISTS "ApCourse_position_idx" ON "ApCourse"("position");

CREATE TABLE IF NOT EXISTS "ApUnit" (
  "id"          TEXT NOT NULL,
  "courseId"    TEXT NOT NULL,
  "number"      INTEGER NOT NULL,
  "title"       TEXT NOT NULL,
  "weighting"   TEXT,
  -- The tick is the timestamp: null means unfinished, a value doubles as "finished on".
  "completedAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApUnit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ApUnit_courseId_number_key" ON "ApUnit"("courseId", "number");
CREATE INDEX        IF NOT EXISTS "ApUnit_courseId_idx"        ON "ApUnit"("courseId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApUnit_courseId_fkey') THEN
    ALTER TABLE "ApUnit" ADD CONSTRAINT "ApUnit_courseId_fkey"
      FOREIGN KEY ("courseId") REFERENCES "ApCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── Row level security ──────────────────────────────────────────────────────
-- As with 012-014: every other public table has RLS on, and a new table does not inherit it.
ALTER TABLE "ApCourse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApUnit"   ENABLE ROW LEVEL SECURITY;

COMMIT;
