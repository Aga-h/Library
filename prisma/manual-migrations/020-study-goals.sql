-- Weekly study goals: an overall target in hours, and an optional one per module.
--
-- Both are stored in minutes, so a goal of 7.5 hours is exact. Null means "no goal", which is
-- also the state every existing module is left in — nothing changes until you set one.
--
-- ADDITIVE: one nullable column and one new single-row table. Run it BEFORE the deploy.
-- REQUIRES 019, which is what renamed EventModule to Module. Run 018, 019, 020 in that order.
--
-- Idempotent: safe to run again.

BEGIN;

ALTER TABLE "Module" ADD COLUMN IF NOT EXISTS "weeklyGoalMinutes" INTEGER;

-- One row, id 'global', created the first time a goal is saved — the same shape as FinanceConfig.
CREATE TABLE IF NOT EXISTS "StudyConfig" (
  "id"                TEXT NOT NULL DEFAULT 'global',
  "weeklyGoalMinutes" INTEGER,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudyConfig_pkey" PRIMARY KEY ("id")
);

-- ─── Row level security ──────────────────────────────────────────────────────
-- As with 012-019: every public table has RLS on, and a new table does not inherit it.
ALTER TABLE "StudyConfig" ENABLE ROW LEVEL SECURITY;

COMMIT;
