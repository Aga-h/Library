-- Self Care → Diet: meals ticked off, and water drunk, per day. The plan itself lives in the repo
-- (lib/meal-plans/); these tables only hold what you did with it.
--
-- ADDITIVE: creates two new tables and touches nothing else. The Diet page still shows the plan
-- before this has run; only the ticks and the water log wait for it.
--
-- Idempotent: safe to run again.

BEGIN;

CREATE TABLE IF NOT EXISTS "MealCheck" (
  "date"      DATE NOT NULL,
  "meal"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MealCheck_pkey" PRIMARY KEY ("date", "meal")
);

CREATE TABLE IF NOT EXISTS "WaterIntake" (
  "id"        TEXT NOT NULL,
  "date"      DATE NOT NULL,
  "ml"        INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WaterIntake_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WaterIntake_date_idx" ON "WaterIntake"("date");

-- ─── Row level security ──────────────────────────────────────────────────────
-- As with every other public table: keeps them out of Supabase's REST API for the anon key.
ALTER TABLE "MealCheck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WaterIntake" ENABLE ROW LEVEL SECURITY;

COMMIT;
