-- Media exchange with a friend's site: what was sent there and what came from there, with the
-- receiver's deadline and when it was finished. See docs/media-exchange.md.
--
-- ADDITIVE: creates one new table and touches nothing else. Run BEFORE (or right as) the
-- deploy — the portal says the exchange is waiting for it until then.
--
-- Idempotent: safe to run again.

BEGIN;

CREATE TABLE IF NOT EXISTS "MediaShare" (
  "id"         TEXT NOT NULL,
  "direction"  TEXT NOT NULL,
  "kind"       TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "media"      JSONB NOT NULL,
  "note"       TEXT,
  "sentAt"     TIMESTAMP(3) NOT NULL,
  "dueAt"      TIMESTAMP(3) NOT NULL,
  "finishedAt" TIMESTAMP(3),
  "notifiedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaShare_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MediaShare_direction_sentAt_idx" ON "MediaShare"("direction", "sentAt");

-- ─── Row level security ──────────────────────────────────────────────────────
-- As with every other public table: keeps it out of Supabase's REST API for the anon key.
ALTER TABLE "MediaShare" ENABLE ROW LEVEL SECURITY;

COMMIT;
