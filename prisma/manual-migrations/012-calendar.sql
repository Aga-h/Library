-- The Calendar section: day plans dealt onto real dates.
--
-- A day plan is a timetable of activities. Each date works out its own kind — weekend always
-- holiday, weekday inside a term school, everything else holiday — and the app deals plans of
-- the matching kind onto it. The kind is DERIVED at read time and deliberately not stored: terms
-- get edited, and a stored kind would go stale and disagree with the calendar.
--
-- Dates are `date`, not `timestamp`. These are calendar dates, not instants; the deploy region
-- is UTC+9 and the user is UTC+3, so a timestamp column would be the wrong day for six hours of
-- every day. Activity times are minutes-from-midnight for the same reason.
--
-- ADDITIVE, so the usual order applies: run this BEFORE deploying the code that uses it.
--
-- Idempotent: safe to run again.

BEGIN;

-- ─── Enum ────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DayKind') THEN
    CREATE TYPE "DayKind" AS ENUM ('SCHOOL', 'HOLIDAY');
  END IF;
END $$;

-- ─── Tables ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "DayPlan" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "kind"      "DayKind" NOT NULL,
  "notes"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DayPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DayPlan_kind_name_key" ON "DayPlan"("kind", "name");
CREATE INDEX IF NOT EXISTS "DayPlan_kind_idx" ON "DayPlan"("kind");

CREATE TABLE IF NOT EXISTS "DayActivity" (
  "id"          TEXT NOT NULL,
  "planId"      TEXT NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute"   INTEGER,
  "title"       TEXT NOT NULL,
  "notes"       TEXT,
  CONSTRAINT "DayActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DayActivity_planId_startMinute_idx" ON "DayActivity"("planId", "startMinute");

CREATE TABLE IF NOT EXISTS "SchoolTerm" (
  "id"        TEXT NOT NULL,
  "name"      TEXT,
  "startDate" DATE NOT NULL,
  "endDate"   DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolTerm_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SchoolTerm_startDate_endDate_idx" ON "SchoolTerm"("startDate", "endDate");

CREATE TABLE IF NOT EXISTS "DayOff" (
  "id"        TEXT NOT NULL,
  "date"      DATE NOT NULL,
  "reason"    TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DayOff_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DayOff_date_key" ON "DayOff"("date");

CREATE TABLE IF NOT EXISTS "CalendarDay" (
  "id"        TEXT NOT NULL,
  "date"      DATE NOT NULL,
  "planId"    TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarDay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CalendarDay_date_key" ON "CalendarDay"("date");
CREATE INDEX IF NOT EXISTS "CalendarDay_planId_idx" ON "CalendarDay"("planId");

-- ─── Foreign keys ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DayActivity_planId_fkey') THEN
    -- Cascade: an activity has no meaning without its plan.
    ALTER TABLE "DayActivity" ADD CONSTRAINT "DayActivity_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "DayPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarDay_planId_fkey') THEN
    -- SetNull: deleting a plan empties the dates that used it, it does not delete the dates.
    ALTER TABLE "CalendarDay" ADD CONSTRAINT "CalendarDay_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "DayPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── Row level security ──────────────────────────────────────────────────────
-- Every other public table already has RLS on, which is what closes the Supabase REST API to
-- the anon key. Without this the five tables above would be the only readable ones in the
-- database. No policies are created: the app connects as the owner over a direct Postgres
-- connection and bypasses RLS, so "enabled with no policy" is exactly the intended deny-all.
ALTER TABLE "DayPlan"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DayActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SchoolTerm"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DayOff"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CalendarDay" ENABLE ROW LEVEL SECURITY;

COMMIT;
