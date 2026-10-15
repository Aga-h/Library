-- Study: flashcards (Anki-style) and quick tests, for the SAT vocabulary.
--
-- Flashcards: one card per word (VocabCard) with its scheduling — state, step, interval, ease,
-- due — and a log of answers (VocabReview) that counts the day's new cards and reviews and lets
-- the last answer be undone. Cards are made by the app the first time the flashcards are opened.
--
-- Quick tests are test runs too, marked QUICK, so they never become the full test's current run
-- and never touch its categories. Every existing run is a full one (the default).
--
-- ADDITIVE: two new tables, two columns on VocabRun, two on StudyConfig. Run it BEFORE (or right
-- as) the deploy — the SAT Vocabulary pages error until it has run.
--
-- Idempotent: safe to run again.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VocabRunKind') THEN
    CREATE TYPE "VocabRunKind" AS ENUM ('FULL', 'QUICK');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VocabCardState') THEN
    CREATE TYPE "VocabCardState" AS ENUM ('NEW', 'LEARNING', 'REVIEW', 'RELEARNING');
  END IF;
END $$;

ALTER TABLE "VocabRun" ADD COLUMN IF NOT EXISTS "kind" "VocabRunKind" NOT NULL DEFAULT 'FULL';
ALTER TABLE "VocabRun" ADD COLUMN IF NOT EXISTS "pool" TEXT;
CREATE INDEX IF NOT EXISTS "VocabRun_kind_startedAt_idx" ON "VocabRun"("kind", "startedAt");

ALTER TABLE "StudyConfig" ADD COLUMN IF NOT EXISTS "flashNewPerDay" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "StudyConfig" ADD COLUMN IF NOT EXISTS "flashReviewsPerDay" INTEGER NOT NULL DEFAULT 200;

CREATE TABLE IF NOT EXISTS "VocabCard" (
  "id"             TEXT NOT NULL,
  "wordId"         TEXT NOT NULL,
  "state"          "VocabCardState" NOT NULL DEFAULT 'NEW',
  "step"           INTEGER NOT NULL DEFAULT 0,
  "interval"       INTEGER NOT NULL DEFAULT 0,
  "ease"           DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  "due"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reps"           INTEGER NOT NULL DEFAULT 0,
  "lapses"         INTEGER NOT NULL DEFAULT 0,
  "newOrder"       INTEGER NOT NULL DEFAULT 0,
  "lastReviewedAt" TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VocabCard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "VocabCard_wordId_key" ON "VocabCard"("wordId");
CREATE INDEX IF NOT EXISTS "VocabCard_state_due_idx" ON "VocabCard"("state", "due");

CREATE TABLE IF NOT EXISTS "VocabReview" (
  "id"          TEXT NOT NULL,
  "cardId"      TEXT NOT NULL,
  "rating"      INTEGER NOT NULL,
  "stateBefore" "VocabCardState" NOT NULL,
  "before"      JSONB NOT NULL,
  "reviewedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VocabReview_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VocabReview_reviewedAt_idx" ON "VocabReview"("reviewedAt");
CREATE INDEX IF NOT EXISTS "VocabReview_cardId_idx" ON "VocabReview"("cardId");

-- A word's card goes with the word; a card's answers go with the card.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VocabCard_wordId_fkey') THEN
    ALTER TABLE "VocabCard" ADD CONSTRAINT "VocabCard_wordId_fkey"
      FOREIGN KEY ("wordId") REFERENCES "VocabWord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VocabReview_cardId_fkey') THEN
    ALTER TABLE "VocabReview" ADD CONSTRAINT "VocabReview_cardId_fkey"
      FOREIGN KEY ("cardId") REFERENCES "VocabCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── Row level security ──────────────────────────────────────────────────────
-- As with every other public table: keeps them out of Supabase's REST API for the anon key.
ALTER TABLE "VocabCard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VocabReview" ENABLE ROW LEVEL SECURITY;

COMMIT;
