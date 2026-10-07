-- Shopping: products. Each shop can hold the things you bought (or looked at) there, each with a
-- comment on that thing in particular — next to the shop's own "liked" / "didn't like" notes.
--
-- ADDITIVE: creates one new table and touches nothing else. Run BEFORE (or right as) the deploy —
-- the Shopping pages error until it has run. Requires 029 (the Shop table).
--
-- Idempotent: safe to run again.

BEGIN;

CREATE TABLE IF NOT EXISTS "ShopProduct" (
  "id"        TEXT NOT NULL,
  "shopId"    TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "comment"   TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopProduct_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ShopProduct_shopId_idx" ON "ShopProduct"("shopId");

-- Deleting a shop deletes its products: they mean nothing without it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShopProduct_shopId_fkey') THEN
    ALTER TABLE "ShopProduct" ADD CONSTRAINT "ShopProduct_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── Row level security ──────────────────────────────────────────────────────
-- As with every other public table: keeps it out of Supabase's REST API for the anon key.
ALTER TABLE "ShopProduct" ENABLE ROW LEVEL SECURITY;

COMMIT;
