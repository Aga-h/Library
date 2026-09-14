-- Events become reusable modules placed into days, instead of rows owned by one day.
--
-- A module is a name plus the hours it occupies — "Sat vocab study 00:00–01:00". Placing it
-- into a day puts that event in that day, and the same module can be placed into any number of
-- days, so renaming it updates all of them.
--
-- ADDITIVE, so the usual order applies: run this BEFORE deploying the code that uses it.
--
-- `DayActivity` is deliberately NOT dropped. It is the only surviving copy of the timetables
-- that existed before this conversion, and it is what makes this reversible if the backfill
-- turns out wrong. A later migration removes it, and per the direction rule that one runs
-- AFTER the deploy that stops reading it.
--
-- Idempotent: safe to run again.

BEGIN;

-- ─── Tables ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "EventModule" (
  "id"          TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute"   INTEGER,
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventModule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EventModule_title_startMinute_endMinute_key"
  ON "EventModule"("title", "startMinute", "endMinute");
CREATE INDEX IF NOT EXISTS "EventModule_startMinute_idx" ON "EventModule"("startMinute");

CREATE TABLE IF NOT EXISTS "DayPlanModule" (
  "id"       TEXT NOT NULL,
  "planId"   TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  CONSTRAINT "DayPlanModule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DayPlanModule_planId_moduleId_key" ON "DayPlanModule"("planId", "moduleId");
CREATE INDEX IF NOT EXISTS "DayPlanModule_planId_idx" ON "DayPlanModule"("planId");
CREATE INDEX IF NOT EXISTS "DayPlanModule_moduleId_idx" ON "DayPlanModule"("moduleId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DayPlanModule_planId_fkey') THEN
    ALTER TABLE "DayPlanModule" ADD CONSTRAINT "DayPlanModule_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "DayPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DayPlanModule_moduleId_fkey') THEN
    ALTER TABLE "DayPlanModule" ADD CONSTRAINT "DayPlanModule_moduleId_fkey"
      FOREIGN KEY ("moduleId") REFERENCES "EventModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── Backfill: every existing activity becomes a module, identical ones merged ──
-- The id is derived from the module's own identity (title + hours), so the same activity in
-- three different days maps to one module — which is the whole point — and re-running this
-- produces the same ids rather than a second set.
--
-- coalesce(endMinute, -1) keeps rows with no end time from colliding with each other in the
-- hash while still grouping identically-ended ones together.
INSERT INTO "EventModule" ("id", "title", "startMinute", "endMinute", "notes", "createdAt", "updatedAt")
SELECT
  'evm_' || substr(md5(a."title" || '|' || a."startMinute" || '|' || coalesce(a."endMinute", -1)), 1, 21),
  a."title",
  a."startMinute",
  a."endMinute",
  -- Notes differed per day; keep one rather than inventing a merge.
  min(a."notes"),
  now(),
  now()
FROM "DayActivity" a
GROUP BY a."title", a."startMinute", a."endMinute"
ON CONFLICT ("id") DO NOTHING;

-- Link each day to the modules its activities became.
INSERT INTO "DayPlanModule" ("id", "planId", "moduleId")
SELECT DISTINCT
  'dpm_' || substr(md5(a."planId" || '|' || a."title" || '|' || a."startMinute" || '|' || coalesce(a."endMinute", -1)), 1, 21),
  a."planId",
  'evm_' || substr(md5(a."title" || '|' || a."startMinute" || '|' || coalesce(a."endMinute", -1)), 1, 21)
FROM "DayActivity" a
ON CONFLICT ("id") DO NOTHING;

-- ─── Row level security ──────────────────────────────────────────────────────
-- As with 012: every other public table has RLS on, and a new table does not inherit it.
ALTER TABLE "EventModule"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DayPlanModule" ENABLE ROW LEVEL SECURITY;

COMMIT;
