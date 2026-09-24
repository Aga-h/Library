-- Ditch the calendar. Modules stay; tasks, days and day plans go.
--
-- What changes, and why:
--
--   * A module is no longer an event with hours in a day. It is just a thing you study, with the
--     stats it trains. You pick one when you start a session.
--   * Tasks are gone. There is no schedule to be judged against, so no 50%-of-the-hours bar, no
--     completed/failed, and no extinguished days.
--   * StudySession grows a module. With one it pays that module's stats; without one it still
--     rolls three at random, for one-off work not worth naming.
--
-- NOTHING EARNED IS LOST. Every task with time on it becomes a study session carrying the same
-- date, the same seconds and the same XP, so levels and day/week/month/total study time come out
-- of this migration unchanged. That conversion happens BEFORE anything is dropped.
--
-- DESTRUCTIVE: day plans, calendar days, school terms, days off and the task rows themselves are
-- deleted and cannot be recovered from the app. Take a Supabase backup first if you want them.
--
-- RUN ORDER: this one is different from the usual "removals go after the deploy". The new code
-- needs the new shape, so run it as soon as the deploy carrying it is live. /study errors until
-- you do.
--
-- Idempotent: safe to run again. Re-running converts nothing twice (the sessions it creates keep
-- the task's own id, so the insert collides with itself and does nothing).

BEGIN;

-- ─── 1. EventModule becomes Module ───────────────────────────────────────────
-- Hours are gone, so the old unique key (title, startMinute, endMinute) is gone with them and
-- the title alone has to be unique. Two modules may well share a title today — "Study" at 14:00
-- and "Study" at 16:00 — so disambiguate rather than fail or silently drop one.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'EventModule')
     AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Module') THEN

    UPDATE "EventModule" m SET "title" = m."title" || ' (' || d.n || ')'
    FROM (
      SELECT "id", row_number() OVER (PARTITION BY lower("title") ORDER BY "startMinute", "id") AS n
      FROM "EventModule"
    ) d
    WHERE d."id" = m."id" AND d.n > 1;

    ALTER TABLE "EventModule" RENAME TO "Module";
  END IF;
END $$;

ALTER TABLE "Module" DROP COLUMN IF EXISTS "startMinute";
ALTER TABLE "Module" DROP COLUMN IF EXISTS "endMinute";

-- Constraint names travel with the rename, so the primary key still says "EventModule".
-- (The old indexes on the dropped columns went with those columns.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventModule_pkey') THEN
    ALTER TABLE "Module" RENAME CONSTRAINT "EventModule_pkey" TO "Module_pkey";
  END IF;
END $$;

DROP INDEX IF EXISTS "EventModule_startMinute_idx";
DROP INDEX IF EXISTS "EventModule_title_startMinute_endMinute_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Module_title_key" ON "Module"("title");
CREATE INDEX        IF NOT EXISTS "Module_title_idx" ON "Module"("title");

-- ─── 2. A session can name what it studied ───────────────────────────────────
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "moduleId" TEXT;
-- The name as well as the id: deleting a module sets moduleId to null, which would otherwise
-- leave its old sessions looking exactly like sessions that never had a module at all.
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "moduleTitle" TEXT;
CREATE INDEX IF NOT EXISTS "StudySession_moduleId_idx" ON "StudySession"("moduleId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudySession_moduleId_fkey') THEN
    ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_moduleId_fkey"
      FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── 3. Carry every worked task across as a study session ────────────────────
-- Keeping the task's id as the session id is what makes this re-runnable: a second pass conflicts
-- with the rows the first pass wrote and does nothing.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Task') THEN

    INSERT INTO "StudySession" ("id", "date", "moduleId", "moduleTitle", "stats", "startedAt", "endedAt", "seconds", "createdAt")
    SELECT t."id",
           t."date",
           t."moduleId",
           m."title",
           m."stats",
           t."startsAt",
           t."startsAt" + make_interval(secs => t."workedSeconds"),
           t."workedSeconds",
           t."createdAt"
    FROM "Task" t
    JOIN "Module" m ON m."id" = t."moduleId"
    WHERE t."workedSeconds" > 0
       OR EXISTS (SELECT 1 FROM "XpAward" x WHERE x."taskId" = t."id")
    ON CONFLICT ("id") DO NOTHING;

    -- Re-point the XP at the session that now stands for that task.
    UPDATE "XpAward" x
    SET "studySessionId" = x."taskId"
    WHERE x."taskId" IS NOT NULL
      AND x."studySessionId" IS NULL
      AND EXISTS (SELECT 1 FROM "StudySession" s WHERE s."id" = x."taskId");
  END IF;
END $$;

-- Anything still unattached earned nothing and belongs to no session. There should be none.
DELETE FROM "XpAward" WHERE "studySessionId" IS NULL;

-- ─── 4. XpAward belongs to a session, and only a session ─────────────────────
ALTER TABLE "XpAward" DROP CONSTRAINT IF EXISTS "XpAward_taskId_fkey";
DROP INDEX IF EXISTS "XpAward_taskId_stat_key";
ALTER TABLE "XpAward" DROP COLUMN IF EXISTS "taskId";
ALTER TABLE "XpAward" ALTER COLUMN "studySessionId" SET NOT NULL;

-- ─── 5. The calendar itself ──────────────────────────────────────────────────
DROP TABLE IF EXISTS "TaskSession" CASCADE;
DROP TABLE IF EXISTS "Task"        CASCADE;
DROP TABLE IF EXISTS "CalendarDay" CASCADE;
DROP TABLE IF EXISTS "DayPlanModule" CASCADE;
DROP TABLE IF EXISTS "DayActivity" CASCADE;
DROP TABLE IF EXISTS "DayPlan"     CASCADE;
DROP TABLE IF EXISTS "DayOff"      CASCADE;
DROP TABLE IF EXISTS "SchoolTerm"  CASCADE;

DROP TYPE IF EXISTS "TaskStatus";
DROP TYPE IF EXISTS "DayKind";

-- ─── Row level security ──────────────────────────────────────────────────────
-- Module carries EventModule's RLS through the rename, but state it rather than trust it.
ALTER TABLE "Module"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudySession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "XpAward"      ENABLE ROW LEVEL SECURITY;

COMMIT;
