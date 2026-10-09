-- Finances: installment purchases (taksit). A price paid over a fixed number of months — like a
-- subscription that ends by itself. The price is stored; each month's share is worked out by the
-- app, to the kuruş, so the installments always add up to it.
--
-- ADDITIVE: creates one new table and touches nothing else. Run BEFORE (or right as) the deploy —
-- the finance pages error until it has run. Creates the FundSource type too if 031 hasn't run yet,
-- exactly as 031 would, so the two can run in either order.
--
-- Idempotent: safe to run again.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FundSource') THEN
    CREATE TYPE "FundSource" AS ENUM ('BASE', 'EXTRA');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Installment" (
  "id"         TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "total"      DOUBLE PRECISION NOT NULL,
  "count"      INTEGER NOT NULL,
  "startYear"  INTEGER NOT NULL,
  "startMonth" INTEGER NOT NULL,
  "source"     "FundSource" NOT NULL DEFAULT 'BASE',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

-- ─── Row level security ──────────────────────────────────────────────────────
-- As with every other public table: keeps it out of Supabase's REST API for the anon key.
ALTER TABLE "Installment" ENABLE ROW LEVEL SECURITY;

COMMIT;
