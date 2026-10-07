-- Shopping: the shops you have tried, filed by category, with what you liked and what you didn't.
--
-- ADDITIVE: creates one new table and touches nothing else. Run BEFORE (or right as) the deploy —
-- the Shopping pages error until it has run; nothing else does.
--
-- Idempotent: safe to run again.

BEGIN;

CREATE TABLE IF NOT EXISTS "Shop" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "url"       TEXT NOT NULL,
  -- Free text: categories are made by filing a shop under one.
  "category"  TEXT NOT NULL,
  "liked"     TEXT,
  "disliked"  TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Shop_category_idx" ON "Shop"("category");

-- ─── Row level security ──────────────────────────────────────────────────────
-- Every other public table has RLS on, and a new table does not inherit it: without this, shops
-- would be the one table readable through Supabase's public REST API with the anon key.
ALTER TABLE "Shop" ENABLE ROW LEVEL SECURITY;

COMMIT;
