-- Tasks are generated from the calendar, and modules carry the stats they train.
--
-- The Tasks section originally shipped with its own "Module" table and its own week grid,
-- duplicating EventModule and the calendar. This removes that duplicate and hangs the task
-- engine off the real calendar instead:
--
--   * EventModule gains `stats` — up to 3 of the 14, empty meaning "just an event".
--   * Task is now (module, date): one row per calendar module per real date, created on demand
--     from the day plan dealt onto that date rather than booked by hand.
--
-- ADDITIVE for the calendar, DESTRUCTIVE for the old task tables: "Module" is dropped, and Task
-- is rebuilt because its shape changed (moduleId now points at EventModule, and `day TEXT`
-- became `date DATE`). Any rows in the old Task/TaskSession/XpAward go with it — they could only
-- have referenced the duplicate modules that are being removed, so there is nothing to carry
-- across. Nothing in the calendar, library, wardrobe or finances is touched.
--
-- The rebuild is guarded on the old shape still being present, so running this a second time
-- leaves real task history alone instead of dropping it.
--
-- Run BEFORE deploying the code that uses it.
--
-- Idempotent: safe to run again.

BEGIN;

-- ─── Stat enum ───────────────────────────────────────────────────────────────
-- Created by the earlier tasks-tables.sql on some databases and not others, so guard it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Stat') THEN
    CREATE TYPE "Stat" AS ENUM (
      'STRENGTH', 'DEXTERITY', 'CONSTITUTION', 'INTELLIGENCE', 'WISDOM', 'CHARISMA', 'RESOLVE',
      'INTUITION', 'COMPOSURE', 'WILLPOWER', 'ESSENCE', 'LOGIC', 'RESONANCE', 'MAGIC'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskStatus') THEN
    CREATE TYPE "TaskStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'FAILED');
  END IF;
END $$;

-- ─── Modules carry stats ─────────────────────────────────────────────────────
-- No NOT NULL and no default, matching what Prisma generates for a scalar list: it reads a NULL
-- array as an empty one, and a default here would show up as drift on every future diff.
ALTER TABLE "EventModule" ADD COLUMN IF NOT EXISTS "stats" "Stat"[];

-- ─── Out with the duplicate module system, and Task rebuilt against the calendar ──
-- Guarded so a second run is a no-op rather than a wipe: the rebuild only happens while the old
-- shape is still there (a "Module" table, or a Task with the old `day TEXT` column, or no Task
-- at all). Once Task has `date`, this block is skipped and any work recorded against it stays.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'Task' AND column_name = 'date')
  THEN
    RAISE NOTICE '014: Task is already calendar-shaped, leaving it and its sessions alone';
  ELSE
    -- Order matters: the children reference Task, and Task referenced "Module".
    DROP TABLE IF EXISTS "XpAward"     CASCADE;
    DROP TABLE IF EXISTS "TaskSession" CASCADE;
    DROP TABLE IF EXISTS "Task"        CASCADE;

    CREATE TABLE "Task" (
      "id"            TEXT NOT NULL,
      "moduleId"      TEXT NOT NULL,
      "date"          DATE NOT NULL,
      "startsAt"      TIMESTAMP(3) NOT NULL,
      "endsAt"        TIMESTAMP(3) NOT NULL,
      "status"        "TaskStatus" NOT NULL DEFAULT 'SCHEDULED',
      "workedSeconds" INTEGER NOT NULL DEFAULT 0,
      "resolvedAt"    TIMESTAMP(3),
      "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"     TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
    );
    -- A module appears at most once in a day plan, so at most once on a date. This is also what
    -- makes materialising a date's tasks safe to repeat on every page load.
    CREATE UNIQUE INDEX "Task_moduleId_date_key" ON "Task"("moduleId", "date");
    CREATE INDEX "Task_date_idx"   ON "Task"("date");
    CREATE INDEX "Task_status_idx" ON "Task"("status");

    CREATE TABLE "TaskSession" (
      "id"        TEXT NOT NULL,
      "taskId"    TEXT NOT NULL,
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "endedAt"   TIMESTAMP(3),
      "seconds"   INTEGER,
      CONSTRAINT "TaskSession_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "TaskSession_taskId_idx" ON "TaskSession"("taskId");

    CREATE TABLE "XpAward" (
      "id"        TEXT NOT NULL,
      "taskId"    TEXT NOT NULL,
      "stat"      "Stat" NOT NULL,
      "amount"    INTEGER NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "XpAward_pkey" PRIMARY KEY ("id")
    );
    -- Paying a task twice is the one thing that must never happen.
    CREATE UNIQUE INDEX "XpAward_taskId_stat_key" ON "XpAward"("taskId", "stat");
    CREATE INDEX "XpAward_stat_idx" ON "XpAward"("stat");

    ALTER TABLE "Task" ADD CONSTRAINT "Task_moduleId_fkey"
      FOREIGN KEY ("moduleId") REFERENCES "EventModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "TaskSession" ADD CONSTRAINT "TaskSession_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "XpAward" ADD CONSTRAINT "XpAward_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- The duplicate module system goes either way; nothing references it once Task is rebuilt.
  DROP TABLE IF EXISTS "Module" CASCADE;
  DROP TYPE  IF EXISTS "ModuleColor";
END $$;

-- ─── Row level security ──────────────────────────────────────────────────────
-- As with 012 and 013: every other public table has RLS on, and a new table does not inherit it.
-- The earlier tasks-tables.sql created its tables without this, which left them readable through
-- the Supabase REST API by the anon key. Rebuilding them here closes that.
ALTER TABLE "Task"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "XpAward"     ENABLE ROW LEVEL SECURITY;

COMMIT;
