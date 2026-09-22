-- Free study: studying when nothing is scheduled.
--
-- A study session has no window and no bar to clear, so it cannot be completed or failed and
-- never counts toward a day's verdict. It banks its time and pays three stats, rolled at random
-- when it starts, one XP per minute.
--
-- That is different enough from a task to be its own table rather than a Task with nullable
-- columns. XpAward therefore has to point at either a task or a study session, so `taskId`
-- becomes nullable and `studySessionId` joins it — exactly one is set on any row.
--
-- ADDITIVE: one new table, one new nullable column, and taskId relaxed from NOT NULL. No data is
-- dropped or rewritten. Run BEFORE deploying the code.
--
-- Idempotent: safe to run again.

BEGIN;

CREATE TABLE IF NOT EXISTS "StudySession" (
  "id"        TEXT NOT NULL,
  "date"      DATE NOT NULL,
  "stats"     "Stat"[],
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt"   TIMESTAMP(3),
  "seconds"   INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StudySession_date_idx" ON "StudySession"("date");

ALTER TABLE "XpAward" ADD COLUMN IF NOT EXISTS "studySessionId" TEXT;
ALTER TABLE "XpAward" ALTER COLUMN "taskId" DROP NOT NULL;

-- Postgres treats NULLs as distinct, so this does not constrain task-sourced rows, and the
-- existing (taskId, stat) index does not constrain study-sourced ones. Each covers its own kind.
CREATE UNIQUE INDEX IF NOT EXISTS "XpAward_studySessionId_stat_key"
  ON "XpAward"("studySessionId", "stat");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'XpAward_studySessionId_fkey') THEN
    ALTER TABLE "XpAward" ADD CONSTRAINT "XpAward_studySessionId_fkey"
      FOREIGN KEY ("studySessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── Row level security ──────────────────────────────────────────────────────
-- As with 012-016: every other public table has RLS on, and a new table does not inherit it.
ALTER TABLE "StudySession" ENABLE ROW LEVEL SECURITY;

COMMIT;
