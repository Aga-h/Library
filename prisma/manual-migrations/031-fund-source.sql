-- Finances: which pot paid. Every expense and subscription is now paid from one of two pots, like
-- two cards — BASE (the monthly budget) or EXTRA (additional income) — and each pot's balance
-- carries over on its own, so the page can say how much is left on each card.
--
-- Everything already recorded is filed under BASE (the column default); move any that were really
-- paid from extra income with a tap on its tag on the month page.
--
-- ADDITIVE: one enum and two columns with a default; nothing is rewritten. Safe to run while the
-- current site is live — the old code never reads these columns. The new code does, so the
-- finance pages error until it has run. (Expenses logged on the phone meanwhile stay queued on the
-- device and upload once it has.)
--
-- Idempotent: safe to run again.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FundSource') THEN
    CREATE TYPE "FundSource" AS ENUM ('BASE', 'EXTRA');
  END IF;
END $$;

ALTER TABLE "Expense"      ADD COLUMN IF NOT EXISTS "source" "FundSource" NOT NULL DEFAULT 'BASE';
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "source" "FundSource" NOT NULL DEFAULT 'BASE';

COMMIT;
