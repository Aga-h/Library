-- Study planner: tasks, the steps under them, subjects (the course) and categories (the kind of
-- work). Subjects and categories are separate on purpose — Mathematics can be Exam Preparation.
--
-- A task with no due date is valid. Dates are real `date` columns, Istanbul calendar days, the
-- same as study sessions. A due time is "HH:MM" text and only stored with a date.
--
-- ADDITIVE: four new tables, two enums, and the seven default categories when the category
-- table is still empty. Run it BEFORE (or right as) the deploy — the Planner page explains
-- itself until this has run, and the rest of Study does not read these tables.
--
-- Idempotent: safe to run again. A second run does not rename categories you have edited and
-- does not put the defaults back once any category exists.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StudyTaskPriority') THEN
    CREATE TYPE "StudyTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StudyTaskStatus') THEN
    CREATE TYPE "StudyTaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "StudySubject" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "color"     TEXT,
  "position"  INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudySubject_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudySubject_name_key" ON "StudySubject"("name");

CREATE TABLE IF NOT EXISTS "StudyCategory" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "color"     TEXT,
  "position"  INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudyCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudyCategory_name_key" ON "StudyCategory"("name");

CREATE TABLE IF NOT EXISTS "StudyTask" (
  "id"          TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "subjectId"   TEXT,
  "categoryId"  TEXT,
  "dueDate"     DATE,
  "dueTime"     TEXT,
  "priority"    "StudyTaskPriority" NOT NULL DEFAULT 'MEDIUM',
  "status"      "StudyTaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "tags"        TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "StudyTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StudyTask_dueDate_idx" ON "StudyTask"("dueDate");
CREATE INDEX IF NOT EXISTS "StudyTask_status_idx" ON "StudyTask"("status");
CREATE INDEX IF NOT EXISTS "StudyTask_subjectId_idx" ON "StudyTask"("subjectId");
CREATE INDEX IF NOT EXISTS "StudyTask_categoryId_idx" ON "StudyTask"("categoryId");

CREATE TABLE IF NOT EXISTS "StudySubtask" (
  "id"        TEXT NOT NULL,
  "taskId"    TEXT NOT NULL,
  "title"     TEXT NOT NULL,
  "done"      BOOLEAN NOT NULL DEFAULT false,
  "position"  INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudySubtask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StudySubtask_taskId_idx" ON "StudySubtask"("taskId");

-- Deleting a subject or category leaves the task, just unfiled. Deleting a task takes its steps.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudyTask_subjectId_fkey') THEN
    ALTER TABLE "StudyTask" ADD CONSTRAINT "StudyTask_subjectId_fkey"
      FOREIGN KEY ("subjectId") REFERENCES "StudySubject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudyTask_categoryId_fkey') THEN
    ALTER TABLE "StudyTask" ADD CONSTRAINT "StudyTask_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "StudyCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudySubtask_taskId_fkey') THEN
    ALTER TABLE "StudySubtask" ADD CONSTRAINT "StudySubtask_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "StudyTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Defaults, only while nothing is filed yet — a later run must not restore a category you deleted
-- or undo a rename.
INSERT INTO "StudyCategory" ("id", "name", "color", "position", "createdAt", "updatedAt")
SELECT v.id, v.name, v.color, v.position, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('cat_homework', 'Homework', 'sky', 0),
  ('cat_exam', 'Exam Preparation', 'orange', 1),
  ('cat_revision', 'Revision', 'violet', 2),
  ('cat_assignments', 'Assignments', 'amber', 3),
  ('cat_reading', 'Reading', 'teal', 4),
  ('cat_projects', 'Projects', 'cyan', 5),
  ('cat_other', 'Other', 'slate', 6)
) AS v(id, name, color, position)
WHERE NOT EXISTS (SELECT 1 FROM "StudyCategory");

-- ─── Row level security ──────────────────────────────────────────────────────
-- As with every other public table: keeps them out of Supabase's REST API for the anon key.
ALTER TABLE "StudySubject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudyCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudyTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudySubtask" ENABLE ROW LEVEL SECURITY;

COMMIT;
